-- Ethio IQ Toolbox — Phase 1 schema
-- Postgres 16 + PostGIS. Safe to re-run — every statement is idempotent
-- (CREATE ... IF NOT EXISTS), so running this against a database that
-- already has the schema applied is a clean no-op instead of a wall of
-- "already exists" errors.
--   psql "$DATABASE_URL" -f database/schema.sql

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ============ CORPORATE CLIENTS (B2B side) ============
CREATE TABLE IF NOT EXISTS corporate_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  industry TEXT,
  billing_email TEXT NOT NULL,
  plan_tier TEXT NOT NULL DEFAULT 'starter',       -- starter | growth | enterprise
  wallet_balance_cents BIGINT NOT NULL DEFAULT 0,  -- prefunded balance for paid-tier surveys
  status TEXT NOT NULL DEFAULT 'active',           -- active | suspended
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES corporate_clients(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',             -- owner | admin | editor | viewer
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ RESPONDENTS (end users, TMA-ready) ============
CREATE TABLE IF NOT EXISTS respondents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id_hash TEXT UNIQUE,           -- SHA-256 of Telegram user ID; null until Phase 2
  device_fingerprint_hash TEXT,           -- hashed device signal, for fraud checks
  phone_hash TEXT,                        -- optional, hashed if collected
  gender TEXT,
  birth_year INT,
  region TEXT,                            -- normalized region/zone, derived from GPS
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_respondents_telegram_hash ON respondents(telegram_id_hash);

-- ============ GEOFENCES ============
-- Created before `surveys` since surveys.target_geofence_id references it.
CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID, -- FK added below after surveys exists (avoids circular create order)
  label TEXT,                                -- e.g. "Addis Ababa - Bole"
  area GEOGRAPHY(POLYGON, 4326),             -- PostGIS polygon; optional
  center GEOGRAPHY(POINT, 4326),
  radius_meters INT
);

-- ============ SURVEYS ============
CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES corporate_clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  tier TEXT NOT NULL DEFAULT 'free',         -- free | paid
  incentive_amount_cents INT DEFAULT 0,      -- micro-incentive per verified completion
  incentive_currency TEXT DEFAULT 'ETB',
  budget_cap_cents BIGINT,                   -- max total spend, paid tier
  target_demographics JSONB,                 -- {"age_min":18,"age_max":35,"gender":["female"]}
  target_geofence_id UUID REFERENCES geofences(id),
  max_responses INT,
  status TEXT NOT NULL DEFAULT 'draft',      -- draft | active | paused | closed
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_geofences_survey'
  ) THEN
    ALTER TABLE geofences
      ADD CONSTRAINT fk_geofences_survey
      FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============ QUESTIONS ============
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  type TEXT NOT NULL,     -- single_choice | multi_choice | scale | nps | open_text | location
  prompt TEXT NOT NULL,
  config JSONB,           -- options, scale range, validation rules
  is_required BOOLEAN NOT NULL DEFAULT true
);

-- ============ RESPONSES (one per survey submission) ============
CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_id UUID NOT NULL REFERENCES respondents(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT NOT NULL,
  device_fingerprint_hash TEXT NOT NULL,
  gps_point GEOGRAPHY(POINT, 4326),      -- captured with permission
  gps_accuracy_meters NUMERIC,
  is_within_geofence BOOLEAN,
  fraud_score NUMERIC DEFAULT 0,         -- 0-1, computed by fraud service
  status TEXT NOT NULL DEFAULT 'pending', -- pending | verified | rejected | flagged
  completion_seconds INT
);
CREATE INDEX IF NOT EXISTS idx_responses_geo ON responses USING GIST (gps_point);
CREATE UNIQUE INDEX IF NOT EXISTS uq_responses_dedup ON responses(survey_id, respondent_id); -- one submission per user per survey

-- ============ ANSWERS (one row per question per response) ============
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  answer_value JSONB NOT NULL,   -- flexible: string, array, number
  sentiment_score NUMERIC,       -- -1 to 1, filled for open_text only
  sentiment_label TEXT           -- positive | neutral | negative
);

-- ============ TRANSACTIONS (paid-tier payouts + client billing) ============
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,        -- payout | client_charge | refund
  respondent_id UUID REFERENCES respondents(id),
  client_id UUID REFERENCES corporate_clients(id),
  response_id UUID REFERENCES responses(id),
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ETB',
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | completed | failed
  payment_method TEXT,        -- telebirr | cbe_birr | bank_transfer
  payout_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ FRAUD LOGS ============
CREATE TABLE IF NOT EXISTS fraud_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES responses(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,        -- duplicate_device | outside_geofence | velocity_flag | ip_reuse
  action_taken TEXT NOT NULL,  -- rejected | flagged_for_review | auto_approved
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ Helpful indexes for the analytics engine (Phase 1, Weeks 8-11) ============
CREATE INDEX IF NOT EXISTS idx_surveys_client ON surveys(client_id);
CREATE INDEX IF NOT EXISTS idx_questions_survey ON questions(survey_id, order_index);
CREATE INDEX IF NOT EXISTS idx_responses_survey ON responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_answers_response ON answers(response_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client ON transactions(client_id);

-- ============ Dashboard performance tuning (Weeks 11-13) ============
-- Materialized view for the *unfiltered* KPI strip + trend line — the common
-- case when a client first opens a survey's analytics view, before they've
-- touched the region/gender/age/date filters. Filtered queries still hit the
-- live tables directly (see apps/api/src/analytics/analytics.service.ts);
-- this view exists purely to make the fast, common path fast, per the
-- blueprint's "materialized views for common aggregations" (section 3).
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_survey_daily_stats AS
SELECT
  r.survey_id,
  date_trunc('day', r.submitted_at) AS day,
  count(*) AS total_responses,
  count(*) FILTER (WHERE r.status != 'rejected') AS non_rejected,
  count(*) FILTER (WHERE r.status = 'flagged') AS flagged,
  avg(a.sentiment_score) FILTER (WHERE a.sentiment_score IS NOT NULL) AS avg_sentiment
FROM responses r
LEFT JOIN answers a ON a.response_id = r.id
GROUP BY r.survey_id, date_trunc('day', r.submitted_at);

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY (see the NestJS
-- scheduler in apps/api/src/analytics/mv-refresh.scheduler.ts, which keeps
-- this view from ever going more than ~2 minutes stale).
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_survey_daily_stats ON mv_survey_daily_stats(survey_id, day);

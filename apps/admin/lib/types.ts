export type QuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'scale'
  | 'nps'
  | 'open_text'
  | 'location';

export interface Question {
  id?: string;
  type: QuestionType;
  prompt: string;
  config?: Record<string, unknown>;
  isRequired?: boolean;
  // client-only key for React lists / dnd-kit before the question has a server id
  clientKey: string;
}

export interface Survey {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  tier: 'free' | 'paid';
  incentive_amount_cents: number;
  incentive_currency: string;
  budget_cap_cents: number | null;
  target_demographics: Record<string, unknown> | null;
  max_responses: number | null;
  status: 'draft' | 'active' | 'paused' | 'closed';
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  response_count?: string;
  questions?: Question[];
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Single choice',
  multi_choice: 'Multiple choice',
  scale: 'Scale',
  nps: 'NPS (0-10)',
  open_text: 'Open text',
  location: 'Location',
};

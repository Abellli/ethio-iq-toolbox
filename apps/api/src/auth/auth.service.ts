import { Inject, Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PG_POOL } from '../config/database.module';
import { OnboardClientDto } from './dto/onboard-client.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Weeks 1-2: corporate client onboarding flow. */
  async onboardClient(dto: OnboardClientDto) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT id FROM client_admin_users WHERE email = $1`,
        [dto.ownerEmail],
      );
      if (existing.rowCount) {
        throw new ConflictException('An account with that email already exists');
      }

      const clientRow = await client.query(
        `INSERT INTO corporate_clients (company_name, industry, billing_email, plan_tier)
         VALUES ($1, $2, $3, COALESCE($4, 'starter'))
         RETURNING id, company_name, plan_tier, status, created_at`,
        [dto.companyName, dto.industry ?? null, dto.billingEmail, dto.planTier ?? null],
      );
      const corporateClient = clientRow.rows[0];

      const passwordHash = await bcrypt.hash(dto.ownerPassword, 12);
      const userRow = await client.query(
        `INSERT INTO client_admin_users (client_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'owner')
         RETURNING id, email, role`,
        [corporateClient.id, dto.ownerEmail, passwordHash],
      );

      await client.query('COMMIT');

      return {
        client: corporateClient,
        user: userRow.rows[0],
        ...(await this.issueTokens(userRow.rows[0].id, corporateClient.id, 'owner', dto.ownerEmail)),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async login(dto: LoginDto) {
    const result = await this.pool.query(
      `SELECT id, client_id, email, password_hash, role FROM client_admin_users WHERE email = $1`,
      [dto.email],
    );
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user.id, user.client_id, user.role, user.email);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      return this.issueTokens(payload.sub, payload.clientId, payload.role, payload.email);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async issueTokens(userId: string, clientId: string, role: string, email: string) {
    const payload = { sub: userId, clientId, role, email };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '7d'),
    });
    return { accessToken, refreshToken };
  }
}

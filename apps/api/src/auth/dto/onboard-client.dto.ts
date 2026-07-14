import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class OnboardClientDto {
  @IsString()
  companyName: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsEmail()
  billingEmail: string;

  @IsOptional()
  @IsIn(['starter', 'growth', 'enterprise'])
  planTier?: string;

  // First admin user (role: owner) created alongside the client record.
  @IsEmail()
  ownerEmail: string;

  @IsString()
  @MinLength(8)
  ownerPassword: string;
}

import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RequestTopupDto {
  @IsInt()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsIn(['telebirr', 'cbe_birr', 'bank_transfer'])
  paymentMethod?: string;
}

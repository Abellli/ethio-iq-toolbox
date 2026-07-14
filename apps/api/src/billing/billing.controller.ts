import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import { RequestTopupDto } from './dto/topup.dto';

@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('wallet')
  getWallet(@Req() req: any) {
    return this.billing.getWallet(req.user.clientId);
  }

  @Get('transactions')
  listTransactions(@Req() req: any) {
    return this.billing.listTransactions(req.user.clientId);
  }

  @Post('topup')
  requestTopup(@Req() req: any, @Body() dto: RequestTopupDto) {
    return this.billing.requestTopup(req.user.clientId, dto);
  }

  @Post('topup/:transactionId/confirm')
  confirmTopup(@Req() req: any, @Param('transactionId') transactionId: string) {
    return this.billing.confirmTopup(req.user.clientId, req.user.role, transactionId);
  }

  @Get('spend')
  getSpend(@Req() req: any) {
    return this.billing.getSpendBySurvey(req.user.clientId);
  }
}

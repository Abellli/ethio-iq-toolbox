import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClientsService } from './clients.service';

@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get('me')
  getMyClient(@Req() req: any) {
    return this.clientsService.getOwnClient(req.user.clientId);
  }

  @Get('me/admins')
  listAdmins(@Req() req: any) {
    return this.clientsService.listAdminUsers(req.user.clientId);
  }
}

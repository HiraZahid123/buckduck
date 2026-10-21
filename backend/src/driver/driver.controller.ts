import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { DriverService } from './driver.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('driver', 'admin')
@Controller('driver')
export class DriverController {
  constructor(private driverService: DriverService) {}

  @Post('toggle-online')
  async toggleOnline(@Request() req: any, @Body() body: { online: boolean }) {
    return this.driverService.toggleOnline(req.user.id, body.online);
  }

  @Get('jobs')
  async getJobBoard(@Request() req: any) {
    return this.driverService.getJobBoard(req.user.id);
  }

  @Post('jobs/:id/accept')
  async acceptJob(@Request() req: any, @Param('id') orderId: string) {
    return this.driverService.acceptJob(req.user.id, Number(orderId));
  }

  @Get('route')
  async getActiveRoute(@Request() req: any) {
    return this.driverService.getActiveRoute(req.user.id);
  }

  @Post('orders/:id/pickup')
  async confirmPickup(
    @Request() req: any,
    @Param('id') orderId: string,
    @Body() body: { bagCount: number },
  ) {
    return this.driverService.confirmPickup(req.user.id, Number(orderId), body.bagCount);
  }

  @Post('orders/:id/deliver')
  async completeDelivery(
    @Request() req: any,
    @Param('id') orderId: string,
    @Body() body: { note: string; photoUrl?: string },
  ) {
    return this.driverService.completeDelivery(req.user.id, Number(orderId), body.note, body.photoUrl);
  }

  @Get('earnings')
  async getEarnings(@Request() req: any) {
    return this.driverService.getEarnings(req.user.id);
  }
}

import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('overview')
  async getOverview() {
    return this.adminService.getOverview();
  }

  @Get('orders')
  async getAllOrders(@Query('status') status?: string) {
    return this.adminService.getAllOrders(status);
  }

  @Get('dispatch')
  async getDispatchBoard() {
    return this.adminService.getDispatchBoard();
  }

  @Post('orders/:id/assign')
  async assignDriver(@Param('id') id: string, @Body() body: { driverId: number }) {
    return this.adminService.assignDriver(Number(id), body.driverId);
  }

  @Post('orders/:id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: { status: string; reason?: string },
  ) {
    return this.adminService.updateOrderStatus(Number(id), body.status, body.reason);
  }

  @Get('stores')
  async getAllStores() {
    return this.adminService.getAllStores();
  }

  @Put('stores/:id')
  async updateStore(
    @Param('id') id: string,
    @Body() body: { status?: string; commissionRate?: number },
  ) {
    return this.adminService.updateStore(Number(id), body);
  }

  @Get('users')
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Put('users/:id/status')
  async updateUserStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.adminService.updateUserStatus(Number(id), body.status);
  }

  @Get('finance')
  async getFinanceSettlement() {
    return this.adminService.getFinanceSettlement();
  }
}

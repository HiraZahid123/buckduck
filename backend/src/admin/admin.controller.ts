import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
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

  @Delete('stores/:id')
  async deleteStore(@Param('id') id: string) {
    return this.adminService.deleteStore(Number(id));
  }

  @Get('users')
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Post('users')
  async createUser(@Body() body: any) {
    return this.adminService.createUser(body);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(Number(id));
  }

  @Post('stores')
  async createStore(@Body() body: any) {
    return this.adminService.createStore(body);
  }

  @Post('drivers')
  async createDriver(@Body() body: any) {
    return this.adminService.createDriver(body);
  }

  @Put('drivers/:id/online')
  async toggleDriverOnline(@Param('id') id: string, @Body() body: { online: boolean }) {
    return this.adminService.toggleDriverOnline(Number(id), body.online);
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

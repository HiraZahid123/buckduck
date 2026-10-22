import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { WindowsService } from './windows.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('windows')
export class WindowsController {
  constructor(private windowsService: WindowsService) {}

  @Get()
  async getActiveWindows() {
    return this.windowsService.getActiveWindows();
  }

  @Get('all')
  async getAllWindows() {
    return this.windowsService.getAllWindows();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  async createWindow(
    @Body() body: { date: string; start_time: string; end_time: string; capacity?: number; label?: string },
  ) {
    return this.windowsService.createWindow(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id')
  async updateWindow(
    @Param('id') id: string,
    @Body() body: { active?: boolean; capacity?: number },
  ) {
    return this.windowsService.updateWindow(Number(id), body);
  }
}

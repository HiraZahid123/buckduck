import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  async getAll() {
    return this.settingsService.getAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put()
  async update(@Body() body: { key: string; value: string }) {
    return this.settingsService.update(body.key, body.value);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put('bulk')
  async updateBulk(@Body() body: Record<string, any>) {
    return this.settingsService.updateBulk(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('broadcast')
  async broadcast(@Body() body: { target: 'merchants' | 'drivers' | 'both'; message: string; title?: string }) {
    return this.settingsService.broadcastAnnouncement(body.target, body.message, body.title);
  }
}

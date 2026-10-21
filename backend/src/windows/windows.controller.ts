import { Controller, Get } from '@nestjs/common';
import { WindowsService } from './windows.service';

@Controller('windows')
export class WindowsController {
  constructor(private windowsService: WindowsService) {}

  @Get()
  async getActiveWindows() {
    return this.windowsService.getActiveWindows();
  }
}

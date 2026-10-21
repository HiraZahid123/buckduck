import { Module } from '@nestjs/common';
import { WindowsService } from './windows.service';
import { WindowsController } from './windows.controller';

@Module({
  providers: [WindowsService],
  controllers: [WindowsController],
  exports: [WindowsService],
})
export class WindowsModule {}

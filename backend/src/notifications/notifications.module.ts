import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

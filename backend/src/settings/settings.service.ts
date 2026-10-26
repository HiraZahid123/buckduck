import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async getAll() {
    const list = await this.prisma.settings.findMany();
    const map: { [key: string]: string } = {};
    for (const item of list) {
      map[item.key] = item.value;
    }
    return map;
  }

  async update(key: string, value: string) {
    return this.prisma.settings.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  async updateBulk(settings: Record<string, any>) {
    const results: any[] = [];
    for (const [key, val] of Object.entries(settings)) {
      if (val !== undefined && val !== null) {
        const item = await this.update(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
        results.push(item);
      }
    }
    return { success: true, count: results.length };
  }

  async broadcastAnnouncement(target: 'merchants' | 'drivers' | 'both', message: string, title?: string) {
    const announcementPayload = {
      target,
      title: title || 'BuckDuck Administrative Announcement',
      message,
      sent_at: new Date().toISOString(),
    };

    // Save to settings history
    await this.update('latest_broadcast', JSON.stringify(announcementPayload));

    // Emit live WebSocket notification to connected merchants / drivers
    this.eventsGateway.emitAnnouncement(target, message, title);

    return { success: true, announcement: announcementPayload };
  }
}

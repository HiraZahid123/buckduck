import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

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
}

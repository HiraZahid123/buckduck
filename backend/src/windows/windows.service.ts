import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WindowsService {
  constructor(private prisma: PrismaService) {}

  async getActiveWindows() {
    const windows = await this.prisma.delivery_windows.findMany({
      where: { active: true },
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    return windows.map((w) => ({
      ...w,
      booked: w._count.orders,
      remaining: Math.max(0, w.capacity - w._count.orders),
      isFull: w._count.orders >= w.capacity,
    }));
  }

  async getAllWindows() {
    const windows = await this.prisma.delivery_windows.findMany({
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    return windows.map((w) => ({
      ...w,
      booked: w._count.orders,
      remaining: Math.max(0, w.capacity - w._count.orders),
    }));
  }

  async createWindow(data: { date: string; start_time: string; end_time: string; capacity?: number; label?: string }) {
    const formatTime = (t: string) => {
      const [hStr, mStr] = t.split(':');
      const h = Number(hStr);
      const m = Number(mStr);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return m ? `${h12}:${m.toString().padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
    };

    const label = data.label || `Window · ${formatTime(data.start_time)} – ${formatTime(data.end_time)}`;
    const capacity = Number(data.capacity) || 120;

    return this.prisma.delivery_windows.upsert({
      where: {
        date_start_time: {
          date: data.date,
          start_time: data.start_time,
        },
      },
      update: {
        end_time: data.end_time,
        label,
        capacity,
        active: true,
        updated_at: new Date(),
      },
      create: {
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        label,
        capacity,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  async updateWindow(id: number, data: { active?: boolean; capacity?: number }) {
    const updateData: any = { updated_at: new Date() };
    if (typeof data.active === 'boolean') updateData.active = data.active;
    if (typeof data.capacity === 'number') updateData.capacity = Number(data.capacity);

    return this.prisma.delivery_windows.update({
      where: { id: Number(id) },
      data: updateData,
    });
  }
}

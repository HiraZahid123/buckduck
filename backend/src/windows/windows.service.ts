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
      orderBy: [{ date: 'desc' }, { start_time: 'asc' }],
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
}

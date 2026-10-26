import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DriverService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private notificationsService: NotificationsService,
  ) {}

  async toggleOnline(driverId: number, isOnline: boolean) {
    const updated = await this.prisma.users.update({
      where: { id: driverId },
      data: { driver_online: Boolean(isOnline), updated_at: new Date() },
      select: { id: true, name: true, driver_online: true },
    });
    this.eventsGateway.emitDriverStatus(updated.id, updated.driver_online, updated.name);
    return updated;
  }

  async getJobBoard(driverId: number) {
    // Street address is hidden for security until accepted!
    const readyOrders = await this.prisma.orders.findMany({
      where: {
        status: 'ready',
        driver_id: null,
      },
      include: {
        stores: {
          select: { name: true, address: true, city: true, state: true, phone: true, color: true, emoji: true },
        },
        delivery_windows: true,
        _count: { select: { order_items: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    return readyOrders.map((o) => ({
      id: o.id,
      number: o.number,
      store: o.stores,
      window: o.delivery_windows,
      bags: o.bags,
      itemCount: o._count.order_items,
      driverPayCents: o.driver_pay_cents,
      tipCents: o.tip_cents,
      destinationZip: o.zip,
      destinationCity: o.city,
      // address_line1 is deliberately omitted!
    }));
  }

  async acceptJob(driverId: number, orderId: number) {
    const activeStops = await this.prisma.orders.count({
      where: {
        driver_id: driverId,
        status: { in: ['ready', 'out_for_delivery'] },
      },
    });

    if (activeStops >= 12) {
      throw new BadRequestException('Driver limit of 12 active route stops reached');
    }

    const order = await this.prisma.orders.findUnique({
      where: { id: Number(orderId) },
    });

    if (!order) {
      throw new NotFoundException('Job not found');
    }

    if (order.driver_id && order.driver_id !== driverId) {
      throw new BadRequestException('Job has already been claimed by another driver');
    }

    return this.prisma.orders.update({
      where: { id: order.id },
      data: {
        driver_id: driverId,
        updated_at: new Date(),
        order_events: {
          create: {
            status: 'claimed',
            note: 'Job claimed by driver',
            actor: 'driver',
            created_at: new Date(),
          },
        },
      },
      include: {
        stores: true,
        delivery_windows: true,
        order_items: true,
      },
    });
  }

  async getActiveRoute(driverId: number) {
    // Full customer address is visible now!
    return this.prisma.orders.findMany({
      where: {
        driver_id: driverId,
        status: { in: ['ready', 'out_for_delivery'] },
      },
      include: {
        stores: true,
        delivery_windows: true,
        order_items: true,
        users_orders_customer_idTousers: {
          select: { name: true, phone: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async confirmPickup(driverId: number, orderId: number, confirmedBags: number) {
    const order = await this.prisma.orders.findUnique({
      where: { id: Number(orderId) },
    });

    if (!order || order.driver_id !== driverId) {
      throw new BadRequestException('Order not assigned to this driver');
    }

    const driver = await this.prisma.users.findUnique({
      where: { id: driverId },
      select: { name: true },
    });

    const updated = await this.prisma.orders.update({
      where: { id: order.id },
      data: {
        status: 'out_for_delivery',
        bags: confirmedBags ? Number(confirmedBags) : order.bags,
        updated_at: new Date(),
        order_events: {
          create: {
            status: 'out_for_delivery',
            note: `Picked up from store with ${confirmedBags || order.bags} bag(s)`,
            actor: 'driver',
            created_at: new Date(),
          },
        },
      },
    });

    // Notify customer automatically via email + real-time status
    await this.notificationsService.notifyOrderStatusChange(order.id, 'out_for_delivery', {
      driverName: driver?.name,
      bags: confirmedBags || order.bags,
    });

    return updated;
  }

  async completeDelivery(driverId: number, orderId: number, note: string, photoUrl?: string) {
    const order = await this.prisma.orders.findUnique({
      where: { id: Number(orderId) },
    });

    if (!order || order.driver_id !== driverId) {
      throw new BadRequestException('Order not assigned to this driver');
    }

    const transferId = `tr_demo_${Date.now()}`;

    const updated = await this.prisma.orders.update({
      where: { id: order.id },
      data: {
        status: 'delivered',
        proof_note: note || 'Left at front door as instructed',
        proof_photo_url: photoUrl || null,
        transfer_id: transferId,
        updated_at: new Date(),
        order_events: {
          create: {
            status: 'delivered',
            note: note || 'Delivered with proof',
            actor: 'driver',
            created_at: new Date(),
          },
        },
      },
      include: {
        stores: true,
      },
    });

    // Notify customer automatically via email + real-time status
    await this.notificationsService.notifyOrderStatusChange(order.id, 'delivered', {
      note: note || 'Delivered with proof',
    });

    return updated;
  }

  async getEarnings(driverId: number) {
    const delivered = await this.prisma.orders.findMany({
      where: { driver_id: driverId, status: 'delivered' },
      orderBy: { updated_at: 'desc' },
    });

    let totalEarnedCents = 0;
    let totalTipsCents = 0;

    for (const o of delivered) {
      totalEarnedCents += o.driver_pay_cents;
      totalTipsCents += o.tip_cents;
    }

    return {
      deliveryCount: delivered.length,
      totalEarnedCents,
      totalTipsCents,
      basePayCents: totalEarnedCents - totalTipsCents,
      recentDeliveries: delivered.slice(0, 10),
    };
  }
}

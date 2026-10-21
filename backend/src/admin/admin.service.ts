import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const orders = await this.prisma.orders.findMany({
      include: { stores: true },
    });

    let gmvCents = 0;
    let netRevenueCents = 0;
    let storePayoutsCents = 0;
    let driverPayCents = 0;
    let deliveredCount = 0;

    for (const o of orders) {
      if (o.status !== 'cancelled' && o.status !== 'refunded') {
        gmvCents += o.subtotal_cents;
        if (o.status === 'delivered') {
          deliveredCount++;
          const netStore = o.subtotal_cents - o.commission_cents;
          storePayoutsCents += netStore;
          driverPayCents += o.driver_pay_cents;
          netRevenueCents += o.commission_cents + o.delivery_fee_cents + o.service_fee_cents - o.driver_pay_cents;
        }
      }
    }

    const storesCount = await this.prisma.stores.count();
    const pendingStoresCount = await this.prisma.stores.count({ where: { status: 'pending' } });
    const usersCount = await this.prisma.users.count();
    const unassignedReadyCount = await this.prisma.orders.count({ where: { status: 'ready', driver_id: null } });

    // Pipeline breakdown
    const pipeline = {
      placed: orders.filter((o) => o.status === 'placed').length,
      accepted: orders.filter((o) => o.status === 'accepted').length,
      packing: orders.filter((o) => o.status === 'packing').length,
      ready: orders.filter((o) => o.status === 'ready').length,
      outForDelivery: orders.filter((o) => o.status === 'out_for_delivery').length,
      delivered: deliveredCount,
    };

    return {
      gmvCents,
      netRevenueCents,
      storePayoutsCents,
      driverPayCents,
      totalOrders: orders.length,
      deliveredOrders: deliveredCount,
      storesCount,
      pendingStoresCount,
      usersCount,
      unassignedReadyCount,
      pipeline,
    };
  }

  async getAllOrders(status?: string) {
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    return this.prisma.orders.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        stores: true,
        delivery_windows: true,
        order_items: true,
        users_orders_customer_idTousers: { select: { id: true, name: true, email: true, phone: true } },
        users_orders_driver_idTousers: { select: { id: true, name: true, phone: true, vehicle: true } },
      },
    });
  }

  async getDispatchBoard() {
    const readyOrders = await this.prisma.orders.findMany({
      where: { status: 'ready', driver_id: null },
      include: {
        stores: true,
        delivery_windows: true,
        order_items: true,
        users_orders_customer_idTousers: { select: { name: true, phone: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    const activeDrivers = await this.prisma.users.findMany({
      where: { role: 'driver' },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicle: true,
        driver_online: true,
        orders_orders_driver_idTousers: {
          where: { status: { in: ['ready', 'out_for_delivery'] } },
          select: { id: true, status: true, number: true },
        },
      },
    });

    const outForDelivery = await this.prisma.orders.findMany({
      where: { status: 'out_for_delivery' },
      include: {
        stores: true,
        users_orders_driver_idTousers: { select: { name: true } },
        users_orders_customer_idTousers: { select: { name: true, phone: true } },
      },
    });

    return {
      unassignedReadyOrders: readyOrders,
      drivers: activeDrivers.map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        vehicle: d.vehicle,
        isOnline: d.driver_online,
        activeStopsCount: d.orders_orders_driver_idTousers.length,
      })),
      outForDelivery,
    };
  }

  async assignDriver(orderId: number, driverId: number) {
    return this.prisma.orders.update({
      where: { id: Number(orderId) },
      data: {
        driver_id: Number(driverId),
        updated_at: new Date(),
        order_events: {
          create: {
            status: 'assigned',
            note: `Driver #${driverId} assigned by admin dispatch`,
            actor: 'admin',
            created_at: new Date(),
          },
        },
      },
      include: {
        users_orders_driver_idTousers: true,
      },
    });
  }

  async updateOrderStatus(orderId: number, status: string, reason?: string) {
    return this.prisma.orders.update({
      where: { id: Number(orderId) },
      data: {
        status,
        updated_at: new Date(),
        order_events: {
          create: {
            status,
            note: reason || `Status manually overridden to ${status} by admin`,
            actor: 'admin',
            created_at: new Date(),
          },
        },
      },
    });
  }

  async getAllStores() {
    return this.prisma.stores.findMany({
      include: {
        users: { select: { name: true, email: true } },
        _count: { select: { orders: true, products: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async updateStore(storeId: number, data: { status?: string; commissionRate?: number }) {
    const updateData: any = { updated_at: new Date() };
    if (data.status) updateData.status = data.status;
    if (data.commissionRate !== undefined) updateData.commission_rate = Number(data.commissionRate);

    return this.prisma.stores.update({
      where: { id: Number(storeId) },
      data: updateData,
    });
  }

  async getAllUsers() {
    return this.prisma.users.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        status: true,
        driver_online: true,
        vehicle: true,
        created_at: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async updateUserStatus(userId: number, status: string) {
    return this.prisma.users.update({
      where: { id: Number(userId) },
      data: { status, updated_at: new Date() },
    });
  }

  async getFinanceSettlement() {
    const orders = await this.prisma.orders.findMany({
      orderBy: { created_at: 'desc' },
      include: { stores: true, users_orders_customer_idTousers: { select: { name: true } } },
    });

    const summary = {
      totalGMVCents: 0,
      totalCommissionCents: 0,
      totalDeliveryFeeCents: 0,
      totalServiceFeeCents: 0,
      totalDriverPayCents: 0,
      totalStorePayoutsCents: 0,
      platformNetRevenueCents: 0,
    };

    for (const o of orders) {
      if (o.status !== 'cancelled' && o.status !== 'refunded') {
        summary.totalGMVCents += o.subtotal_cents;
        summary.totalCommissionCents += o.commission_cents;
        summary.totalDeliveryFeeCents += o.delivery_fee_cents;
        summary.totalServiceFeeCents += o.service_fee_cents;
        summary.totalDriverPayCents += o.driver_pay_cents;
        summary.totalStorePayoutsCents += o.subtotal_cents - o.commission_cents;
      }
    }

    summary.platformNetRevenueCents =
      summary.totalCommissionCents +
      summary.totalDeliveryFeeCents +
      summary.totalServiceFeeCents -
      summary.totalDriverPayCents;

    return {
      summary,
      recentSettlements: orders.slice(0, 15),
    };
  }
}

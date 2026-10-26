import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MerchantService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async getStoreForUser(userId: number) {
    const store = await this.prisma.stores.findFirst({
      where: { owner_id: userId },
    });
    if (!store) {
      throw new NotFoundException('No store found for this merchant account');
    }
    return store;
  }

  async getDashboard(storeId: number) {
    const orders = await this.prisma.orders.findMany({
      where: { store_id: storeId },
      include: { order_items: true },
    });

    const counts = {
      new: 0,
      accepted: 0,
      packing: 0,
      ready: 0,
      delivered: 0,
      totalBags: 0,
    };

    let lifetimeSalesCents = 0;
    let netPayoutCents = 0;

    for (const o of orders) {
      if (o.status === 'placed') counts.new++;
      else if (o.status === 'accepted') counts.accepted++;
      else if (o.status === 'packing') {
        counts.packing++;
        counts.totalBags += o.bags || 1;
      } else if (o.status === 'ready') {
        counts.ready++;
        counts.totalBags += o.bags || 1;
      } else if (o.status === 'delivered') {
        counts.delivered++;
        lifetimeSalesCents += o.subtotal_cents;
        netPayoutCents += o.subtotal_cents - o.commission_cents;
      }
    }

    const products = await this.prisma.products.findMany({
      where: { store_id: storeId, active: true },
      orderBy: { stock: 'asc' },
      take: 5,
    });

    return {
      counts,
      lifetimeSalesCents,
      netPayoutCents,
      lowStockProducts: products.filter((p) => p.stock <= 10),
    };
  }

  async getOrders(storeId: number) {
    return this.prisma.orders.findMany({
      where: { store_id: storeId },
      orderBy: { created_at: 'desc' },
      include: {
        order_items: true,
        delivery_windows: true,
        users_orders_customer_idTousers: {
          select: { name: true, phone: true },
        },
      },
    });
  }

  async updateOrderStatus(storeId: number, orderId: number, status: string, bagCount?: number) {
    const order = await this.prisma.orders.findUnique({
      where: { id: Number(orderId) },
    });

    if (!order || order.store_id !== storeId) {
      throw new NotFoundException('Order not found for your store');
    }

    const updateData: any = {
      status,
      updated_at: new Date(),
    };

    if (status === 'ready' && bagCount) {
      updateData.bags = Number(bagCount);
    }

    const updated = await this.prisma.orders.update({
      where: { id: order.id },
      data: {
        ...updateData,
        order_events: {
          create: {
            status,
            note: status === 'ready' ? `Marked ready with ${bagCount || order.bags} BuckDuck bag(s)` : `Status changed to ${status}`,
            actor: 'merchant',
            created_at: new Date(),
          },
        },
      },
      include: {
        order_items: true,
        delivery_windows: true,
      },
    });

    // Send automated email notification to customer
    await this.notificationsService.notifyOrderStatusChange(order.id, status, {
      note: status === 'ready' ? `Marked ready with ${bagCount || order.bags} bag(s)` : undefined,
      bags: bagCount || order.bags,
    });

    return updated;
  }

  async getProducts(storeId: number) {
    return this.prisma.products.findMany({
      where: { store_id: storeId },
      orderBy: { id: 'desc' },
    });
  }

  async createProduct(storeId: number, data: any) {
    const now = new Date();
    return this.prisma.products.create({
      data: {
        store_id: storeId,
        name: data.name,
        description: data.description || null,
        category: data.category || 'General',
        price_cents: Number(data.price_cents),
        unit: data.unit || 'each',
        stock: Number(data.stock || 20),
        emoji: data.emoji || '🛒',
        image_url: data.image_url || null,
        active: true,
        created_at: now,
        updated_at: now,
      },
    });
  }

  async updateProduct(storeId: number, productId: number, data: any) {
    const prod = await this.prisma.products.findUnique({
      where: { id: Number(productId) },
    });

    if (!prod || prod.store_id !== storeId) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.products.update({
      where: { id: prod.id },
      data: {
        name: data.name ?? prod.name,
        description: data.description ?? prod.description,
        category: data.category ?? prod.category,
        price_cents: data.price_cents !== undefined ? Number(data.price_cents) : prod.price_cents,
        unit: data.unit ?? prod.unit,
        stock: data.stock !== undefined ? Number(data.stock) : prod.stock,
        emoji: data.emoji ?? prod.emoji,
        image_url: data.image_url ?? prod.image_url,
        active: data.active !== undefined ? Boolean(data.active) : prod.active,
        updated_at: new Date(),
      },
    });
  }

  async updateStore(storeId: number, data: any) {
    return this.prisma.stores.update({
      where: { id: storeId },
      data: {
        name: data.name,
        tagline: data.tagline,
        description: data.description,
        category: data.category,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        phone: data.phone,
        color: data.color,
        emoji: data.emoji,
        updated_at: new Date(),
      },
    });
  }

  async getPayouts(storeId: number) {
    const store = await this.prisma.stores.findUnique({
      where: { id: storeId },
    });

    const orders = await this.prisma.orders.findMany({
      where: { store_id: storeId, status: 'delivered' },
      orderBy: { updated_at: 'desc' },
    });

    const pendingOrders = await this.prisma.orders.findMany({
      where: { store_id: storeId, status: { in: ['placed', 'accepted', 'packing', 'ready'] } },
    });

    const deliveredTotal = orders.reduce((acc, o) => acc + (o.subtotal_cents - o.commission_cents), 0);
    const pendingTotal = pendingOrders.reduce((acc, o) => acc + (o.subtotal_cents - o.commission_cents), 0);

    return {
      store,
      stripeConnected: store?.stripe_charges_enabled || false,
      stripeAccountId: store?.stripe_account_id || null,
      totalTransferredCents: deliveredTotal,
      pendingPayoutCents: pendingTotal,
      recentPayoutOrders: orders.slice(0, 10),
    };
  }
}

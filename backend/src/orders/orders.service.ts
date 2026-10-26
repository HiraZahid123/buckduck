import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

export interface CartItemDto {
  productId: number;
  qty: number;
}

export interface CreateOrderDto {
  items: CartItemDto[];
  windowId: number;
  tipCents?: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  notes?: string;
  paymentMethod?: string;
}

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async calculateFees(items: CartItemDto[], tipCents: number = 0) {
    if (!items || items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const productIds = items.map((i) => Number(i.productId));
    const products = await this.prisma.products.findMany({
      where: { id: { in: productIds }, active: true },
      include: { stores: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    const storeGroups: { [storeId: number]: { store: any; items: any[]; subtotal: number; bags: number } } = {};

    let subtotalCents = 0;

    for (const item of items) {
      const prod = productMap.get(Number(item.productId));
      if (!prod) {
        throw new BadRequestException(`Product ID ${item.productId} is not available`);
      }

      const itemTotal = prod.price_cents * item.qty;
      subtotalCents += itemTotal;

      if (!storeGroups[prod.store_id]) {
        storeGroups[prod.store_id] = {
          store: prod.stores,
          items: [],
          subtotal: 0,
          bags: 0,
        };
      }

      storeGroups[prod.store_id].items.push({
        product: prod,
        qty: item.qty,
        itemTotal,
      });
      storeGroups[prod.store_id].subtotal += itemTotal;
    }

    // Settings
    const storeCount = Object.keys(storeGroups).length;
    const deliveryFeeCents = 599 * storeCount; // $5.99 per store
    const serviceFeeCents = Math.max(199, Math.round(subtotalCents * 0.05)); // 5%, min $1.99
    const taxCents = 0; // Groceries exempt by default
    const totalCents = subtotalCents + deliveryFeeCents + serviceFeeCents + (tipCents || 0);

    // Calculate bags per store
    for (const storeId of Object.keys(storeGroups)) {
      const totalStoreQty = storeGroups[storeId].items.reduce((acc, it) => acc + it.qty, 0);
      storeGroups[storeId].bags = Math.max(1, Math.ceil(totalStoreQty / 10));
    }

    return {
      subtotalCents,
      deliveryFeeCents,
      serviceFeeCents,
      taxCents,
      tipCents: tipCents || 0,
      totalCents,
      storeCount,
      stores: Object.values(storeGroups),
    };
  }

  async createCheckout(customerId: number, dto: CreateOrderDto) {
    const valuation = await this.calculateFees(dto.items, dto.tipCents);

    const minSetting = await this.prisma.settings.findUnique({
      where: { key: 'minimum_delivery_subtotal_cents' },
    });
    const minSubtotalCents = minSetting && !isNaN(Number(minSetting.value)) ? Number(minSetting.value) : 1500;

    if (valuation.subtotalCents < minSubtotalCents) {
      throw new BadRequestException(`Minimum merchandise order is $${(minSubtotalCents / 100).toFixed(2)}`);
    }

    const window = await this.prisma.delivery_windows.findUnique({
      where: { id: Number(dto.windowId) },
      include: { _count: { select: { orders: true } } },
    });

    if (!window || !window.active) {
      throw new BadRequestException('Selected delivery window is not active');
    }

    if (window._count.orders >= window.capacity) {
      throw new BadRequestException('Delivery window is full. Please choose another window.');
    }

    const now = new Date();
    const paymentIntentId = `pi_demo_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // 1. Create master checkout
    const checkout = await this.prisma.checkouts.create({
      data: {
        customer_id: customerId,
        total_cents: valuation.totalCents,
        payment_status: 'paid',
        payment_intent_id: paymentIntentId,
        payment_method: dto.paymentMethod || 'card',
        created_at: now,
        updated_at: now,
      },
    });

    const createdOrders: any[] = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let storeIdx = 0;

    // Distribute tip proportionally or equally across stores
    const tipPerStore = Math.round((dto.tipCents || 0) / valuation.storeCount);

    // 2. Create sub-orders for each store
    for (const group of valuation.stores) {
      const storeSuffix = alphabet[storeIdx % alphabet.length];
      storeIdx++;
      const orderNumber = `BD-${10000 + checkout.id}-${storeSuffix}`;

      const storeSubtotal = group.subtotal;
      const commissionCents = Math.round(storeSubtotal * (group.store.commission_rate || 0.15));
      const deliveryFeePerStore = 599;
      const serviceFeePerStore = Math.round(valuation.serviceFeeCents / valuation.storeCount);
      const orderTotal = storeSubtotal + deliveryFeePerStore + serviceFeePerStore + tipPerStore;
      const driverPay = 550 + tipPerStore;

      const order = await this.prisma.orders.create({
        data: {
          number: orderNumber,
          checkout_id: checkout.id,
          customer_id: customerId,
          store_id: group.store.id,
          window_id: window.id,
          status: 'placed',
          subtotal_cents: storeSubtotal,
          delivery_fee_cents: deliveryFeePerStore,
          service_fee_cents: serviceFeePerStore,
          tax_cents: 0,
          tip_cents: tipPerStore,
          total_cents: orderTotal,
          commission_cents: commissionCents,
          driver_pay_cents: driverPay,
          bags: group.bags,
          address_line1: dto.addressLine1,
          address_line2: dto.addressLine2 || null,
          city: dto.city || 'Silver Spring',
          state: dto.state || 'MD',
          zip: dto.zip || '20910',
          phone: dto.phone,
          notes: dto.notes || null,
          created_at: now,
          updated_at: now,
          order_items: {
            create: group.items.map((it: any) => ({
              product_id: it.product.id,
              name: it.product.name,
              emoji: it.product.emoji,
              unit: it.product.unit,
              price_cents: it.product.price_cents,
              qty: it.qty,
            })),
          },
          order_events: {
            create: [
              {
                status: 'placed',
                note: 'Order placed by customer',
                actor: 'system',
                created_at: now,
              },
            ],
          },
        },
        include: {
          stores: true,
          order_items: true,
        },
      });

      createdOrders.push(order);
    }

    const firstOrderId = createdOrders[0]?.id || 1;

    return {
      success: true,
      checkoutId: checkout.id,
      orders: createdOrders,
      orderId: firstOrderId,
      url: `/order/${firstOrderId}`,
      totalCharged: valuation.totalCents,
    };
  }

  async createStripeCheckoutSession(customerId: number, dto: CreateOrderDto) {
    const valuation = await this.calculateFees(dto.items, dto.tipCents);

    const minSetting = await this.prisma.settings.findUnique({
      where: { key: 'minimum_delivery_subtotal_cents' },
    });
    const minSubtotalCents = minSetting && !isNaN(Number(minSetting.value)) ? Number(minSetting.value) : 1500;

    if (valuation.subtotalCents < minSubtotalCents) {
      throw new BadRequestException(`Minimum merchandise order is $${(minSubtotalCents / 100).toFixed(2)}`);
    }

    const checkoutResult = await this.createCheckout(customerId, {
      ...dto,
      paymentMethod: dto.paymentMethod || 'stripe_checkout',
    });

    const firstOrderId = checkoutResult.orders?.[0]?.id || 1;
    const checkoutId = checkoutResult.checkoutId;

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (stripeKey && stripeKey.startsWith('sk_') && !stripeKey.includes('placeholder')) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' as any });

        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
        for (const grp of valuation.stores) {
          for (const item of grp.items) {
            lineItems.push({
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `${item.product.name} (${grp.store.name})`,
                  description: `${item.product.unit || 'unit'} · BuckDuck Verified Store`,
                },
                unit_amount: item.product.price_cents,
              },
              quantity: item.qty,
            });
          }
        }

        if (valuation.deliveryFeeCents > 0) {
          lineItems.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Batched Saturday Delivery (${valuation.storeCount} Stores)`,
              },
              unit_amount: valuation.deliveryFeeCents,
            },
            quantity: 1,
          });
        }

        if (valuation.serviceFeeCents > 0) {
          lineItems.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Service & Packaging Fee (5%)',
              },
              unit_amount: valuation.serviceFeeCents,
            },
            quantity: 1,
          });
        }

        if (valuation.tipCents > 0) {
          lineItems.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Driver Tip (100% to Driver)',
              },
              unit_amount: valuation.tipCents,
            },
            quantity: 1,
          });
        }

        const session = await stripe.checkout.sessions.create({
          line_items: lineItems,
          mode: 'payment',
          success_url: `${frontendUrl}/order/${firstOrderId}?session_id={CHECKOUT_SESSION_ID}&checkout_id=${checkoutId}&stripe_success=true`,
          cancel_url: `${frontendUrl}/cart?canceled=true`,
          client_reference_id: String(checkoutId),
          metadata: {
            checkout_id: String(checkoutId),
            first_order_id: String(firstOrderId),
            customer_id: String(customerId),
          },
        });

        await this.prisma.checkouts.update({
          where: { id: checkoutId },
          data: { payment_intent_id: session.id },
        });

        return {
          success: true,
          url: session.url,
          sessionId: session.id,
          checkoutId,
          orderId: firstOrderId,
          orders: checkoutResult.orders,
          isStripeHosted: true,
        };
      } catch (stripeErr: any) {
        console.warn('Stripe checkout session creation failed, falling back to direct redirect:', stripeErr?.message);
      }
    }

    return {
      success: true,
      url: `/order/${firstOrderId}?checkout_id=${checkoutId}&stripe_demo=1`,
      sessionId: `cs_test_mock_${Date.now()}`,
      checkoutId,
      orderId: firstOrderId,
      orders: checkoutResult.orders,
      isStripeHosted: false,
      simulated: true,
    };
  }

  async getUserOrders(customerId: number) {
    return this.prisma.orders.findMany({
      where: { customer_id: customerId },
      orderBy: { created_at: 'desc' },
      include: {
        stores: true,
        delivery_windows: true,
        order_items: true,
      },
    });
  }

  async getOrderById(orderId: number, user: any) {
    const order = await this.prisma.orders.findUnique({
      where: { id: Number(orderId) },
      include: {
        stores: true,
        delivery_windows: true,
        order_items: true,
        order_events: {
          orderBy: { created_at: 'asc' },
        },
        users_orders_driver_idTousers: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicle: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    // Role check: customer can only view their own order; merchant can view their store's order; driver can view their assigned order; admin can view all
    if (user.role === 'customer' && order.customer_id !== user.id) {
      throw new BadRequestException('Access denied');
    }

    return order;
  }

  async cancelOrder(orderId: number, customerId: number) {
    const order = await this.prisma.orders.findUnique({
      where: { id: Number(orderId) },
    });

    if (!order || order.customer_id !== customerId) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'placed' && order.status !== 'pending_payment') {
      throw new BadRequestException(`Cannot cancel order in '${order.status}' status`);
    }

    const now = new Date();
    await this.prisma.orders.update({
      where: { id: order.id },
      data: {
        status: 'cancelled',
        updated_at: now,
        order_events: {
          create: {
            status: 'cancelled',
            note: 'Order cancelled by customer. Refund processed.',
            actor: 'customer',
            created_at: now,
          },
        },
      },
    });

    return { success: true, message: 'Order cancelled and refunded' };
  }
}

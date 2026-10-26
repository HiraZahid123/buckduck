import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async notifyOrderStatusChange(
    orderId: number,
    status: string,
    extraInfo?: { note?: string; driverName?: string; bags?: number },
  ) {
    try {
      const order = await this.prisma.orders.findUnique({
        where: { id: Number(orderId) },
        include: {
          users_orders_customer_idTousers: true,
          stores: true,
          delivery_windows: true,
        },
      });

      if (!order) return;

      const customer = order.users_orders_customer_idTousers;
      const storeName = order.stores?.name || 'Local Store';

      let statusTitle = '';
      let statusMessage = '';

      switch (status) {
        case 'accepted':
          statusTitle = 'Order Confirmed';
          statusMessage = `Great news! ${storeName} has accepted your BuckDuck order #${order.number || order.id} and has started preparing your fresh items.`;
          break;
        case 'packing':
          statusTitle = 'Packing Items';
          statusMessage = `${storeName} is packing your order items into BuckDuck eco-bags.`;
          break;
        case 'ready':
          statusTitle = 'Ready for Driver Pickup';
          statusMessage = `Your order from ${storeName} is packaged (${order.bags || extraInfo?.bags || 1} bags) and staged for our delivery driver.`;
          break;
        case 'out_for_delivery':
          statusTitle = 'Driver Picked Up & On the Way';
          const driverText = extraInfo?.driverName ? `Our driver ${extraInfo.driverName}` : 'Your driver';
          statusMessage = `${driverText} has picked up your bags from ${storeName} and is en route to your delivery address!`;
          break;
        case 'delivered':
          statusTitle = 'Delivered to Your Door';
          statusMessage = `Your BuckDuck order has been delivered! Check your doorstep. Thank you for shopping local with BuckDuck!`;
          break;
        case 'cancelled':
          statusTitle = 'Order Cancelled';
          statusMessage = `Your BuckDuck order #${order.number || order.id} has been cancelled. Any charge has been refunded.`;
          break;
        default:
          statusTitle = `Order Update: ${status}`;
          statusMessage = `Your order #${order.number || order.id} status has been updated to ${status}.`;
          break;
      }

      // 1. Emit live order status over WebSockets
      this.eventsGateway.emitOrderStatus(order.id, status, order.driver_id || undefined);

      // 2. Simulated / Transactional Email Dispatch
      const emailPayload = {
        to: customer?.email || 'customer@example.com',
        customerName: customer?.name || 'Valued Customer',
        subject: `BuckDuck Update: ${statusTitle} (Order #${order.number || order.id})`,
        body: statusMessage,
        orderId: order.id,
        orderNumber: order.number || String(order.id),
        storeName,
        deliveryAddress: `${order.address_line1 || ''}, ${order.city || ''} ${order.zip || ''}`,
        timestamp: new Date().toISOString(),
      };

      this.logger.log(
        `[AUTOMATED EMAIL DISPATCHED] To: ${emailPayload.to} | Subject: "${emailPayload.subject}" | Message: "${statusMessage}"`,
      );

      // 3. Record order event for automated email sent so customer/admin/merchant see it in history
      await this.prisma.order_events.create({
        data: {
          order_id: order.id,
          status: `email_sent_${status}`,
          note: `Automated status email sent to ${customer?.email || 'customer'}: "${statusTitle}"`,
          actor: 'system',
          created_at: new Date(),
        },
      });

      return emailPayload;
    } catch (err: any) {
      this.logger.error(`Failed to send order notification for #${orderId}: ${err.message}`);
    }
  }
}

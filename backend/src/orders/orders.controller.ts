import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { OrdersService, CartItemDto, CreateOrderDto } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post('calculate')
  async calculate(@Body() body: { items: CartItemDto[]; tipCents?: number }) {
    return this.ordersService.calculateFees(body.items, body.tipCents || 0);
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.createStripeCheckoutSession(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-stripe-session')
  async createStripeSession(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.createStripeCheckoutSession(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-orders')
  async getMyOrders(@Request() req: any) {
    return this.ordersService.getUserOrders(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getOrderById(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.getOrderById(Number(id), req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  async cancelOrder(@Request() req: any, @Param('id') id: string) {
    return this.ordersService.cancelOrder(Number(id), req.user.id);
  }
}

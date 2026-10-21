import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('merchant', 'admin')
@Controller('merchant')
export class MerchantController {
  constructor(private merchantService: MerchantService) {}

  private async getStoreId(req: any): Promise<number> {
    if (req.user.role === 'admin' && req.query.store_id) {
      return Number(req.query.store_id);
    }
    const store = await this.merchantService.getStoreForUser(req.user.id);
    return store.id;
  }

  @Get('dashboard')
  async getDashboard(@Request() req: any) {
    const storeId = await this.getStoreId(req);
    return this.merchantService.getDashboard(storeId);
  }

  @Get('orders')
  async getOrders(@Request() req: any) {
    const storeId = await this.getStoreId(req);
    return this.merchantService.getOrders(storeId);
  }

  @Post('orders/:id/status')
  async updateStatus(
    @Request() req: any,
    @Param('id') orderId: string,
    @Body() body: { status: string; bagCount?: number },
  ) {
    const storeId = await this.getStoreId(req);
    return this.merchantService.updateOrderStatus(storeId, Number(orderId), body.status, body.bagCount);
  }

  @Get('products')
  async getProducts(@Request() req: any) {
    const storeId = await this.getStoreId(req);
    return this.merchantService.getProducts(storeId);
  }

  @Post('products')
  async createProduct(@Request() req: any, @Body() body: any) {
    const storeId = await this.getStoreId(req);
    return this.merchantService.createProduct(storeId, body);
  }

  @Put('products/:id')
  async updateProduct(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const storeId = await this.getStoreId(req);
    return this.merchantService.updateProduct(storeId, Number(id), body);
  }

  @Get('payouts')
  async getPayouts(@Request() req: any) {
    const storeId = await this.getStoreId(req);
    return this.merchantService.getPayouts(storeId);
  }

  @Put('store')
  async updateStore(@Request() req: any, @Body() body: any) {
    const storeId = await this.getStoreId(req);
    return this.merchantService.updateStore(storeId, body);
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query('q') query?: string,
    @Query('category') category?: string,
    @Query('store_id') storeId?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.findAll(query, category, storeId, limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.productsService.findById(Number(id));
  }
}

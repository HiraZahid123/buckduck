import { Controller, Get, Param, Query } from '@nestjs/common';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
  constructor(private storesService: StoresService) {}

  @Get()
  async findAll(@Query('category') category?: string) {
    return this.storesService.findAll(category);
  }

  @Get('categories')
  async getCategories() {
    return this.storesService.getCategories();
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.storesService.findBySlug(slug);
  }
}

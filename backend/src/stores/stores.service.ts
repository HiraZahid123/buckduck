import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async findAll(category?: string) {
    const where: any = { status: 'active' };
    if (category && category !== 'All') {
      where.category = category;
    }
    return this.prisma.stores.findMany({
      where,
      orderBy: { rating: 'desc' },
      include: {
        products: {
          where: { active: true },
          take: 4,
        },
      },
    });
  }

  async findBySlug(slug: string) {
    const store = await this.prisma.stores.findUnique({
      where: { slug },
      include: {
        products: {
          where: { active: true },
          orderBy: { category: 'asc' },
        },
      },
    });

    if (!store) {
      throw new NotFoundException(`Store with slug '${slug}' not found`);
    }

    const banner = await this.prisma.settings.findUnique({
      where: { key: `store_banner_${store.id}` },
    });
    let customerBanner = null;
    if (banner?.value) {
      try {
        customerBanner = JSON.parse(banner.value);
      } catch {}
    }

    return {
      ...store,
      customer_banner: customerBanner,
    };
  }

  async getCategories() {
    const stores = await this.prisma.stores.findMany({
      where: { status: 'active' },
      select: { category: true },
      distinct: ['category'],
    });
    return ['All', ...stores.map((s) => s.category)];
  }
}

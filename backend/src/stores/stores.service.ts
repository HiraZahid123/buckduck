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

    return store;
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query?: string, category?: string, storeId?: number) {
    const where: any = { active: true };
    if (storeId) {
      where.store_id = Number(storeId);
    }
    if (category && category !== 'All') {
      where.category = category;
    }
    if (query && query.trim()) {
      where.OR = [
        { name: { contains: query.trim(), mode: 'insensitive' } },
        { description: { contains: query.trim(), mode: 'insensitive' } },
      ];
    }

    return this.prisma.products.findMany({
      where,
      include: {
        stores: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            emoji: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async findById(id: number) {
    const product = await this.prisma.products.findUnique({
      where: { id: Number(id) },
      include: {
        stores: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }
}

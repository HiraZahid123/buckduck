import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CachedProduct {
  id: number;
  name: string;
  description: string;
  category: string;
  price_cents: number;
  unit: string;
  stock: number;
  emoji: string;
  image_url: string;
  store_id: number;
  active: boolean;
  stores?: {
    id: number;
    name: string;
    slug: string;
    color: string;
    emoji: string;
  };
}

@Injectable()
export class ProductsService {
  // In-memory catalog cache for lightning fast sub-millisecond search
  private cache: CachedProduct[] = [];
  private cacheExpiresAt: number = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

  constructor(private prisma: PrismaService) {}

  /**
   * Refreshes or retrieves the in-memory products cache from Neon DB
   */
  private async getCachedCatalog(): Promise<CachedProduct[]> {
    const now = Date.now();
    if (this.cache.length > 0 && now < this.cacheExpiresAt) {
      return this.cache;
    }

    const products = await this.prisma.products.findMany({
      where: { active: true },
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

    this.cache = products as CachedProduct[];
    this.cacheExpiresAt = now + this.CACHE_TTL_MS;
    return this.cache;
  }

  /**
   * Invalidate cache on mutations
   */
  invalidateCache() {
    this.cache = [];
    this.cacheExpiresAt = 0;
  }

  async findAll(query?: string, category?: string, storeId?: number, limit?: number) {
    const catalog = await this.getCachedCatalog();

    let results = catalog;

    if (storeId) {
      const sId = Number(storeId);
      results = results.filter((p) => p.store_id === sId);
    }

    if (category && category !== 'All') {
      const catLower = category.toLowerCase();
      results = results.filter((p) => p.category?.toLowerCase() === catLower);
    }

    if (query && query.trim()) {
      const qTokens = query.toLowerCase().trim().split(/\s+/);
      results = results.filter((p) => {
        const text = `${p.name} ${p.description || ''} ${p.category || ''} ${p.stores?.name || ''}`.toLowerCase();
        return qTokens.every((token) => text.includes(token));
      });
    }

    if (limit && limit > 0) {
      return results.slice(0, Number(limit));
    }

    return results;
  }

  async findById(id: number) {
    const catalog = await this.getCachedCatalog();
    const found = catalog.find((p) => p.id === Number(id));
    if (found) return found;

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

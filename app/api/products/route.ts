import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { products, stores, platforms } from '@/db/schema';
import { eq, and, desc, asc, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

const ProductsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  platformId: z.string().optional(),
  storeId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'draft', 'archived']).optional(),
  sortBy: z.enum(['title', 'price', 'stock', 'createdAt', 'updatedAt', 'lastSyncAt']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryData = Object.fromEntries(searchParams.entries());
    const validatedData = ProductsQuerySchema.parse(queryData);

    // Build the base query
    let query = db.select({
      id: products.id,
      storeId: products.storeId,
      platformId: products.platformId,
      platformProductId: products.platformProductId,
      sku: products.sku,
      title: products.title,
      description: products.description,
      shortDescription: products.shortDescription,
      price: products.price,
      comparePrice: products.comparePrice,
      cost: products.cost,
      currency: products.currency,
      stock: products.stock,
      trackInventory: products.trackInventory,
      weight: products.weight,
      dimensions: products.dimensions,
      images: products.images,
      categories: products.categories,
      tags: products.tags,
      status: products.status,
      isActive: products.isActive,
      isVisible: products.isVisible,
      platformMetadata: products.platformMetadata,
      seo: products.seo,
      variants: products.variants,
      attributes: products.attributes,
      lastSyncAt: products.lastSyncAt,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      storeName: stores.name,
      platformName: platforms.displayName,
    })
      .from(products)
      .innerJoin(stores, eq(products.storeId, stores.id))
      .innerJoin(platforms, eq(products.platformId, platforms.id))
      .where(and(
        eq(stores.userId, session.user.id),
        eq(products.isActive, true)
      ));

    // Apply filters
    const conditions = [];

    if (validatedData.search) {
      const searchTerm = `%${validatedData.search}%`;
      conditions.push(
        or(
          ilike(products.title, searchTerm),
          ilike(products.sku, searchTerm),
          ilike(products.description, searchTerm)
        )
      );
    }

    if (validatedData.platformId) {
      conditions.push(eq(products.platformId, validatedData.platformId));
    }

    if (validatedData.storeId) {
      conditions.push(eq(products.storeId, validatedData.storeId));
    }

    if (validatedData.status) {
      conditions.push(eq(products.status, validatedData.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Get total count for pagination
    const countQuery = db.select({ count: products.id })
      .from(products)
      .innerJoin(stores, eq(products.storeId, stores.id))
      .where(and(
        eq(stores.userId, session.user.id),
        eq(products.isActive, true)
      ));

    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }

    const [totalResult] = await countQuery;
    const totalItems = totalResult ? Number(totalResult.count) : 0;

    // Apply sorting
    const sortColumn = {
      title: products.title,
      price: products.price,
      stock: products.stock,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      lastSyncAt: products.lastSyncAt,
    }[validatedData.sortBy];

    if (sortColumn) {
      query = query.orderBy(
        validatedData.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)
      );
    }

    // Apply pagination
    const offset = (validatedData.page - 1) * validatedData.limit;
    const products_list = await query
      .limit(validatedData.limit)
      .offset(offset);

    // Calculate pagination info
    const totalPages = Math.ceil(totalItems / validatedData.limit);
    const hasNextPage = validatedData.page < totalPages;
    const hasPreviousPage = validatedData.page > 1;

    return NextResponse.json({
      success: true,
      data: products_list,
      pagination: {
        currentPage: validatedData.page,
        totalPages,
        totalItems,
        itemsPerPage: validatedData.limit,
        hasNextPage,
        hasPreviousPage,
      },
    });

  } catch (error) {
    console.error('Products API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
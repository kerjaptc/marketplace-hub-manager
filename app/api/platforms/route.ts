import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { platforms } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

    // Get all active platforms
    const platforms_list = await db.select({
      id: platforms.id,
      name: platforms.name,
      displayName: platforms.displayName,
      type: platforms.type,
      isActive: platforms.isActive,
      description: platforms.description,
    })
      .from(platforms)
      .where(eq(platforms.isActive, true))
      .orderBy(platforms.displayName);

    return NextResponse.json(platforms_list);

  } catch (error) {
    console.error('Platforms API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
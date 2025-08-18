import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/options';
import { prisma } from '@/lib/db';
import { GoogleAdapter } from '@/lib/providers/google';
import { YelpAdapter } from '@/lib/providers/yelp';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const locationId = searchParams.get('locationId');
    const since = searchParams.get('since');

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's organization
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
      include: { org: true }
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 400 }
      );
    }

    // Get OAuth connection for the provider
    const connection = await prisma.oAuthConnection.findFirst({
      where: {
        orgId: membership.orgId,
        provider: provider as any
      }
    });

    let reviews = [];

    // Fetch reviews based on provider
    if (provider === 'google') {
      if (!connection?.accessToken || !locationId) {
        return NextResponse.json(
          { error: 'Missing required parameters' },
          { status: 400 }
        );
      }
      
      reviews = await GoogleAdapter.listReviews({
        accessToken: connection.accessToken,
        locationExternalId: locationId,
        since
      });
    } 
    else if (provider === 'yelp') {
      if (!locationId) {
        return NextResponse.json(
          { error: 'Location ID is required for Yelp' },
          { status: 400 }
        );
      }
      reviews = await YelpAdapter.listReviews({ locationExternalId: locationId });
    }
    // Facebook doesn't support API access for reviews

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

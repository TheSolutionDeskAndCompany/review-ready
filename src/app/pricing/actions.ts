'use server';

import { auth } from '@/auth';
import { createCheckoutSession as createStripeCheckoutSession } from '@/lib/stripe';
import { prisma } from '@/lib/db';

export async function createCheckoutSession(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error('You must be signed in to purchase a plan');
  }

  const priceId = formData.get('priceId');
  if (typeof priceId !== 'string') {
    throw new Error('Invalid price ID');
  }

  // Get the user's organization
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { org: true },
  });

  if (!membership) {
    throw new Error('Organization not found');
  }

  // Create a checkout session
  const stripeSession = await createStripeCheckoutSession({
    priceId,
    customerEmail: session.user.email,
    orgId: membership.orgId,
  });

  if (!stripeSession.url) {
    throw new Error('Failed to create checkout session');
  }

  return { url: stripeSession.url };
}

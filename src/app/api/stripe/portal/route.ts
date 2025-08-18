import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(){
  const session = await getServerSession(authOptions);
  if(!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  // Find the user's org via membership
  const membership = await prisma.membership.findFirst({ where:{ userId: session.user.id } });
  if(!membership) return new Response('No membership', { status: 404 });

  const sub = await prisma.subscription.findUnique({ where:{ orgId: membership.orgId } });
  if(!sub?.stripeCustomerId) return new Response('No customer', { status: 404 });

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${process.env.APP_URL||'http://localhost:3000'}/app/settings`
  });

  return Response.json({ url: portal.url });
}

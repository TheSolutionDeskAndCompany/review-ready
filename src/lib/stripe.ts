import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
});

export async function createCheckoutSession({
  priceId,
  customerEmail,
  orgId,
}: {
  priceId: string;
  customerEmail: string;
  orgId: string;
}) {
  if (!process.env.APP_URL) {
    throw new Error('APP_URL is not set');
  }

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: customerEmail,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/pricing?canceled=true`,
    client_reference_id: orgId,
    metadata: {
      orgId,
    },
  });
}

export async function getSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function getCustomer(customerId: string) {
  return stripe.customers.retrieve(customerId);
}

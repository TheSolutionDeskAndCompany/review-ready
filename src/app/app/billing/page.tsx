import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { CheckCircle2, Loader2 } from "lucide-react";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  // Get the user's organization and subscription
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: {
      org: {
        include: {
          subscription: true,
        },
      },
    },
  });

  if (!membership) {
    redirect("/auth/signin");
  }

  const subscription = membership.org.subscription;

  // Create a portal session for managing the subscription
  async function createPortalSession() {
    "use server";
    
    if (!subscription?.stripeCustomerId) {
      throw new Error("No subscription found");
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.APP_URL}/app/billing`,
    });

    redirect(portalSession.url);
  }

  return (
    <div className="container max-w-4xl py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing information
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {subscription?.plan ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) : 'No Plan'}
            </h2>
            <p className="text-muted-foreground">
              {subscription?.status === 'active' ? (
                <span className="flex items-center text-green-600">
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Active
                </span>
              ) : (
                'Inactive'
              )}
            </p>
          </div>

          {subscription?.stripeCustomerId ? (
            <form action={createPortalSession}>
              <Button type="submit">
                Manage Subscription
              </Button>
            </form>
          ) : (
            <Button asChild>
              <a href="/pricing">Upgrade Plan</a>
            </Button>
          )}
        </div>

        {subscription?.currentPeriodEnd && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground">
              {subscription.status === 'canceled' 
                ? 'Your subscription will end on '
                : 'Your next billing date is '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Billing History</h2>
        <div className="rounded-lg border">
          <div className="p-4 text-center text-muted-foreground">
            {subscription?.stripeCustomerId ? (
              <p>Your billing history will appear here</p>
            ) : (
              <p>No billing history available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

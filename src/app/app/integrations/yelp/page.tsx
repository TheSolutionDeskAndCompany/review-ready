import { auth } from "@/auth";
import { YelpConnect } from "@/components/integrations/YelpConnect";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function YelpIntegrationPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  // Check if user has an organization
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: {
      org: true,
    },
  });

  if (!membership) {
    redirect("/app/onboard");
  }

  // Check if Yelp is already connected
  const yelpConnection = await prisma.integration.findFirst({
    where: {
      orgId: membership.orgId,
      provider: 'yelp',
    },
  });

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Yelp Integration</h1>
        <p className="text-muted-foreground">
          Connect your Yelp business to monitor and respond to reviews
        </p>
      </div>

      <YelpConnect />
    </div>
  );
}

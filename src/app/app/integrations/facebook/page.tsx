import { auth } from "@/auth";
import { FacebookConnect } from "@/components/integrations/FacebookConnect";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function FacebookIntegrationPage() {
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

  // Check if Facebook is already connected
  const facebookConnection = await prisma.integration.findFirst({
    where: {
      orgId: membership.orgId,
      provider: 'facebook',
    },
  });

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Facebook Integration</h1>
        <p className="text-muted-foreground">
          Connect your Facebook Business Page to manage reviews in one place
        </p>
      </div>

      <FacebookConnect />
      
      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="font-medium mb-2">1. Connect Your Page</div>
            <p className="text-sm text-muted-foreground">
              Authorize ReviewReady to access your Facebook Page reviews
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="font-medium mb-2">2. View All Reviews</div>
            <p className="text-sm text-muted-foreground">
              See all your Facebook reviews in one unified dashboard
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="font-medium mb-2">3. Respond with Ease</div>
            <p className="text-sm text-muted-foreground">
              Reply to reviews directly from ReviewReady
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { MainNav } from "@/components/nav";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <DashboardCard
              title="Total Reviews"
              value="0"
              description="Across all platforms"
            />
            <DashboardCard
              title="Average Rating"
              value="0.0"
              description="From all reviews"
            />
            <DashboardCard
              title="Pending Replies"
              value="0"
              description="Needs your attention"
            />
            <DashboardCard
              title="Connected Accounts"
              value="0"
              description="Out of 3 platforms"
            />
          </div>
          
          <div className="mt-8">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
            <div className="mt-4 rounded-md border">
              <div className="p-4 text-center text-muted-foreground">
                No recent activity
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

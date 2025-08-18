import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prisma } from "@/lib/db";
import { CheckCircle2, MessageSquare, Star, XCircle } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <div>Please sign in to view this page</div>;
  }

  // Get the user's organization and reviews
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: {
      org: {
        include: {
          reviews: {
            orderBy: { createdAt: 'desc' },
            include: {
              replies: true,
              location: true,
            },
          },
          locations: true,
        },
      },
    },
  });

  if (!membership) {
    return <div>No organization found</div>;
  }

  const { org } = membership;
  const { reviews } = org;

  // Categorize reviews
  const newReviews = reviews.filter((review) => !review.replies.length);
  const repliedReviews = reviews.filter((review) => review.replies.length > 0);

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name || 'User'}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/reviews/new">Reply to Reviews</Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviews.length}</div>
            <p className="text-xs text-muted-foreground">
              Across all locations
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Reviews</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newReviews.length}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting your response
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reviews.length > 0
                ? Math.round((repliedReviews.length / reviews.length) * 100)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">
              of reviews responded to
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reviews Tabs */}
      <Tabs defaultValue="new" className="space-y-4">
        <TabsList>
          <TabsTrigger value="new">New Reviews ({newReviews.length})</TabsTrigger>
          <TabsTrigger value="replied">Replied ({repliedReviews.length})</TabsTrigger>
          <TabsTrigger value="all">All Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-4">
          {newReviews.length > 0 ? (
            newReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No new reviews to display
            </div>
          )}
        </TabsContent>

        <TabsContent value="replied" className="space-y-4">
          {repliedReviews.length > 0 ? (
            repliedReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No replied reviews yet
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No reviews yet
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReviewCard({ review }: { review: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-medium">{review.authorName || 'Anonymous'}</span>
            <span className="text-sm text-muted-foreground">
              • {new Date(review.createdAt).toLocaleDateString()}
            </span>
            {review.rating && (
              <div className="flex items-center text-yellow-500">
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < review.rating ? 'fill-current' : ''
                      }`}
                    />
                  ))}
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {review.location?.name || 'Unknown Location'}
          </div>
        </div>
        <div>
          {review.replies.length > 0 ? (
            <div className="flex items-center text-sm text-green-600">
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Replied
            </div>
          ) : (
            <div className="flex items-center text-sm text-amber-600">
              <XCircle className="mr-1 h-4 w-4" />
              No reply
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4">{review.text || 'No review text available'}</p>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/app/reviews/${review.id}`}>
            {review.replies.length > 0 ? 'View Reply' : 'Reply'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

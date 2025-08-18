import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { ArrowLeft, MessageSquare, Star } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function ReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  // Get the review with the given ID
  const review = await prisma.review.findUnique({
    where: { id: params.id },
    include: {
      location: true,
      replies: {
        include: {
          author: {
            select: {
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!review) {
    notFound();
  }

  // Check if user has permission to view this review
  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      orgId: review.orgId,
    },
  });

  if (!membership) {
    // User doesn't have permission
    redirect("/app/dashboard");
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="mb-6">
        <Button asChild variant="ghost" className="mb-4 -ml-2">
          <Link href="/app/dashboard" className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reviews
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Review Details</h1>
      </div>

      {/* Review Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="font-medium">
                  {review.authorName || 'Anonymous'}
                </span>
                <span className="text-sm text-muted-foreground">
                  • {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              {review.rating && (
                <div className="flex items-center text-yellow-500 mb-2">
                  {Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < review.rating! ? 'fill-current' : ''
                        }`}
                      />
                    ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {review.location?.name || 'Unknown Location'}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {review.platform}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line">{review.text || 'No review text'}</p>
        </CardContent>
      </Card>

      {/* Reply Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <MessageSquare className="mr-2 h-5 w-5" />
            Response
          </h2>
          {review.replies.length === 0 && (
            <Button asChild>
              <Link href={`/app/reviews/${review.id}/reply`}>
                Reply to Review
              </Link>
            </Button>
          )}
        </div>

        {review.replies.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">
                    {review.replies[0].author?.name || 'Your Team'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(review.replies[0].createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {review.replies[0].platform}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line">{review.replies[0].text}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No response yet</p>
              <Button variant="link" asChild className="mt-2">
                <Link href={`/app/reviews/${review.id}/reply`}>
                  Add a response
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

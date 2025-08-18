import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { Star } from "lucide-react";
import { notFound, redirect } from "next/navigation";

export default async function ReplyPage({
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
      replies: true,
    },
  });

  if (!review) {
    notFound();
  }

  // Check if user has permission to reply to this review
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

  // Handle form submission
  async function submitReply(formData: FormData) {
    "use server";
    
    const text = formData.get("reply") as string;
    if (!text.trim()) {
      return { error: "Reply cannot be empty" };
    }

    // Check if already replied
    if (review?.replies.length > 0) {
      return { error: "A reply already exists for this review" };
    }

    // Post reply to the appropriate platform
    let success = false;
    
    try {
      // This would call the appropriate provider's reply method
      // For now, we'll just create a reply in the database
      await prisma.reviewReply.create({
        data: {
          reviewId: review.id,
          text,
          authorId: session!.user!.id,
          platform: review.platform,
          platformReplyId: `local-${Date.now()}`,
        },
      });
      
      success = true;
    } catch (error) {
      console.error("Failed to post reply:", error);
      return { error: "Failed to post reply. Please try again." };
    }

    if (success) {
      redirect(`/app/reviews/${review.id}`);
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Reply to Review</h1>
      
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

      {/* Reply Form */}
      <Card>
        <CardHeader>
          <CardTitle>Your Response</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitReply} className="space-y-4">
            <Textarea
              name="reply"
              placeholder="Type your response here..."
              className="min-h-[200px]"
              required
              defaultValue={
                review.replies[0]?.text || ''
              }
              disabled={review.replies.length > 0}
            />
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={review.replies.length > 0}
              >
                {review.replies.length > 0 ? 'Already Replied' : 'Submit Response'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

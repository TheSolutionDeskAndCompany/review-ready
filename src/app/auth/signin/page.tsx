import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            Welcome to ReviewReady
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to manage your business reviews
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <div className="space-y-4">
            <form action="/api/auth/signin/google" method="POST">
              <Button
                type="submit"
                variant="outline"
                className="w-full"
              >
                <FcGoogle className="mr-2 h-5 w-5" />
                Sign in with Google
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

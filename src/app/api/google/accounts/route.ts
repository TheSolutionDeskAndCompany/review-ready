import { getServerSession } from "next-auth/next";
import { getGoogleAccessTokenForUser } from "@/lib/google-oauth";
import { listGbpAccounts } from "@/lib/gbp";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const token = await getGoogleAccessTokenForUser(session.user.id);
  const accounts = await listGbpAccounts(token);
  const simplified = accounts.map(a => ({ 
    id: a.name.split("/").pop(), 
    name: a.accountName || a.name, 
    rawName: a.name 
  }));
  return Response.json(simplified);
}

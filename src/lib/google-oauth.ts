import { prisma } from "@/lib/db";

type Tokens = { access_token: string; expires_in?: number; refresh_token?: string; };

export async function getGoogleAccessTokenForUser(userId: string) {
  const acct = await prisma.account.findFirst({ where: { userId, provider: "google" } });
  if (!acct?.access_token) throw new Error("Google not connected");
  const now = Math.floor(Date.now() / 1000);
  const expired = acct.expires_at ? acct.expires_at < now + 60 : false;

  if (!expired) return acct.access_token as string;
  if (!acct.refresh_token) throw new Error("No Google refresh token");

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: acct.refresh_token!,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(await res.text());
  const t = (await res.json()) as Tokens;

  await prisma.account.update({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: acct.providerAccountId } },
    data: { access_token: t.access_token, expires_at: now + (t.expires_in || 3500) },
  });

  return t.access_token;
}

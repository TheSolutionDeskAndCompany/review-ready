import { getServerSession } from "next-auth/next";
import { getGoogleAccessTokenForUser } from "@/lib/google-oauth";
import { listGbpLocations } from "@/lib/gbp";
import { authOptions } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: { accountId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const token = await getGoogleAccessTokenForUser(session.user.id);

  const locs = await listGbpLocations(token, params.accountId);
  const simplified = locs.map((l) => {
    // l.name: "accounts/{aid}/locations/{lid}"
    const providerLocationId = (l.name || "").split("/").pop();
    type Address = {
      addressLines?: string[];
      locality?: string;
      administrativeArea?: string;
      postalCode?: string;
    };
    const addr: Address = l.address || {};
    const addrStr = [ ...(addr.addressLines || []), addr.locality, addr.administrativeArea, addr.postalCode ].filter(Boolean).join(", ");
    return {
      providerLocationId,
      title: l.title || l.locationName || providerLocationId,
      address: addrStr,
      rawName: l.name,
    };
  });
  return Response.json(simplified);
}

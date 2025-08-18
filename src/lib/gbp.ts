export type GbpAccount = { name: string; accountName?: string; type?: string; };
export type GbpLocation = { name: string; locationName?: string; title?: string; address?: { postalCode?: string; locality?: string; administrativeArea?: string; addressLines?: string[] } };

const BASE = "https://mybusiness.googleapis.com/v4";

export async function listGbpAccounts(accessToken: string): Promise<GbpAccount[]> {
  const r = await fetch(`${BASE}/accounts`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  return data.accounts || [];
}

export async function listGbpLocations(accessToken: string, accountId: string): Promise<GbpLocation[]> {
  const out: GbpLocation[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${BASE}/accounts/${encodeURIComponent(accountId)}/locations`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    (data.locations || []).forEach((l: GbpLocation) => out.push(l));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

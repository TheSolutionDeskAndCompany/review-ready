"use client";

import { useEffect, useState } from "react";

type Account = { id: string; name: string; rawName: string };
type Location = { providerLocationId: string; title: string; address?: string; rawName: string };

export default function GoogleLocationsPicker() {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/google/accounts");
        if (!res.ok) throw new Error(await res.text());
        const accs = await res.json();
        setAccounts(accs);
        if (accs[0]) setAccountId(accs[0].id);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to load accounts';
        setMsg(errorMessage);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/google/accounts/${accountId}/locations`);
        if (!res.ok) throw new Error(await res.text());
        const locs = await res.json();
        setLocations(locs);
        setSelected({});
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to load locations';
        setMsg(errorMessage);
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId]);

  async function saveAndBackfill() {
    const chosen = locations.filter(l => selected[l.providerLocationId]);
    if (!chosen.length) return setMsg("Select at least one location.");
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch("/api/google/locations/select", {
        method: "POST", 
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selected: chosen }),
      });
      if (!r.ok) throw new Error(await r.text());

      // Backfill each
      for (const c of chosen) {
        const bf = await fetch("/api/sync/google", {
          method: "POST", 
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ providerLocationId: c.providerLocationId }),
        });
        if (!bf.ok) throw new Error(await bf.text());
      }
      setMsg(`Connected ${chosen.length} location(s) and backfilled reviews.`);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to save/backfill';
      setMsg(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm">Google Account</label>
        <select 
          className="border rounded-md px-3 py-2 text-sm"
          value={accountId}
          onChange={e => setAccountId(e.target.value)}
          disabled={loading}
        >
          {accounts.map(a => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="border rounded-xl p-3 max-h-72 overflow-auto">
        {!locations.length && (
          <div className="text-sm text-muted-foreground">No locations found.</div>
        )}
        {locations.map(l => (
          <label key={l.providerLocationId} className="flex items-start gap-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={!!selected[l.providerLocationId]}
              onChange={e => setSelected(s => ({ ...s, [l.providerLocationId]: e.target.checked }))}
              className="mt-1"
            />
            <div>
              <div className="font-medium">{l.title}</div>
              <div className="text-xs text-muted-foreground">{l.address}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={saveAndBackfill}
          disabled={loading}
          className="px-3 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
        >
          {loading ? "Working…" : "Save & Backfill"}
        </button>
        {msg && <div className="text-xs text-muted-foreground">{msg}</div>}
      </div>
    </div>
  );
}

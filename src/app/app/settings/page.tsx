import type { Metadata } from "next";
import GoogleLocationsPicker from "@/components/settings/google-locations-picker";
import JobHistory from "@/components/settings/job-history";
import ResyncEmailButton from "@/components/settings/resync-email-button";
import Link from "next/link";

export const metadata: Metadata = { title: "Settings • ReviewReady" };

export default async function SettingsPage(){
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Connect providers and manage billing.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="border rounded-2xl p-4 md:col-span-2">
          <h3 className="font-semibold">Google Business Profile</h3>
          <p className="text-sm text-muted-foreground">Sign in with Google, then choose the locations to sync. You can reply in-app to Google reviews.</p>
          <div className="mt-4">
            <GoogleLocationsPicker />
          </div>
        </div>

        <div className="border rounded-2xl p-4">
          <h3 className="font-semibold">Yelp</h3>
          <p className="text-sm text-muted-foreground">View last 3 reviews via Fusion; reply on Yelp.</p>
          <span className="mt-3 inline-flex rounded-md border px-3 py-2 text-sm">Partner access pending</span>
        </div>

        <div className="border rounded-2xl p-4 md:col-span-3">
          <h3 className="font-semibold">Facebook</h3>
          <p className="text-sm text-muted-foreground">Store your Page link to jump to reviews.</p>
          <Link className="mt-3 inline-flex rounded-md border px-3 py-2 text-sm" href="/app/settings">
            Add Page link
          </Link>
        </div>

        <div className="border rounded-2xl p-4 md:col-span-3 space-y-4">
          <div>
            <h3 className="font-semibold">Google Reviews Sync</h3>
            <p className="text-sm text-muted-foreground">Re-import reviews and get a CSV by email.</p>
            <div className="mt-3">
              <ResyncEmailButton />
            </div>
          </div>
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Recent Jobs</h4>
            <JobHistory />
          </div>
        </div>

        <div className="border rounded-2xl p-4 md:col-span-3">
          <h3 className="font-semibold">Billing</h3>
          <p className="text-sm text-muted-foreground">
            Manage your subscription, payment method, and invoices.
          </p>
          <form action="/api/stripe/portal" method="post">
            <button className="mt-3 inline-flex rounded-md bg-black text-white px-3 py-2 text-sm" type="submit">
              Open customer portal
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

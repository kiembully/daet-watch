import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Daet Watch collects, and what it shows publicly.",
};

export default function PrivacyPage() {
  return (
    <article className="space-y-4 p-5 text-sm leading-relaxed text-body">
      <h1 className="text-xl font-bold text-ink">Privacy</h1>

      <p>
        Daet Watch is a community project. It is not run by the Municipality of Daet, and no
        government office sees your account details.
      </p>

      <h2 className="pt-2 text-base font-bold text-ink">What we store</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your sign-in identity: name, email or phone number, and profile photo if you use one.</li>
        <li>Your barangay, if you pick one.</li>
        <li>The reports, confirmations, votes and comments you post.</li>
        <li>Rate-limit counters, so one account cannot flood the feed.</li>
      </ul>

      <h2 className="pt-2 text-base font-bold text-ink">What is public</h2>
      <p>
        Reports, photos, comments and the DAYS UNFIXED counter are public, and issue pages are
        shareable. Your name is <strong>hidden by default</strong> — reports show a generated name
        such as &ldquo;Neighbor from Brgy. Lag-On&rdquo;. You can choose to show your real name in
        Profile → Settings. Your email and phone number are never shown.
      </p>

      <h2 className="pt-2 text-base font-bold text-ink">Photos</h2>
      <p>
        Photos are compressed on your phone before upload and stored by Cloudinary. Removing a
        report removes it from the public feed; the image file may remain in Cloudinary&apos;s cache
        for a short period.
      </p>

      <h2 className="pt-2 text-base font-bold text-ink">Deleting your data</h2>
      <p>
        Ask a moderator to delete your account and reports. Every report you file carries your
        account id internally so this is possible.
      </p>

      <p className="pt-4 text-xs text-muted">
        Community-reported. Not verified by the LGU. Last updated when this file changed.
      </p>
    </article>
  );
}

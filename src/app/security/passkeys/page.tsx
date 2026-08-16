import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasskeyManager } from "./passkey-manager";

export const metadata: Metadata = {
  title: "Face ID security",
};

export default async function PasskeysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="passkeys-title">
        <p className="eyebrow">Security</p>
        <h1 className="security-title" id="passkeys-title">
          Face ID access
        </h1>
        <p className="auth-intro">
          A passkey lets this iPhone unlock My Cellar with Face ID. Your face is
          checked by the iPhone and is never shared with the app.
        </p>
        <PasskeyManager />
        <Link className="settings-row" href="/backup">
          <span>
            <strong>Export &amp; Backup</strong>
            <small>Download your cellar data and photograph list</small>
          </span>
          <b aria-hidden="true">›</b>
        </Link>
      </section>
    </main>
  );
}

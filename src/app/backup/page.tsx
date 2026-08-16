import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Export & Backup" };

const exports = [
  {
    href: "/backup/export?file=cellar",
    title: "Cellar",
    copy: "Wines, quantities, shelves, drinking windows, grapes, prices and notes.",
  },
  {
    href: "/backup/export?file=transactions",
    title: "Transactions",
    copy: "The complete inventory ledger: bottles added, drunk and adjusted.",
  },
  {
    href: "/backup/export?file=diary",
    title: "Drinking diary",
    copy: "Every drinking event, personal rating and tasting note.",
  },
  {
    href: "/backup/export?file=photos",
    title: "Photograph manifest",
    copy: "A list of label photographs with private links for downloading each original.",
  },
];

export default async function BackupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="backup-shell">
      <header className="backup-header">
        <Link className="back-link" href="/security/passkeys">← Settings</Link>
        <p className="eyebrow">Your data</p>
        <h1>Export &amp; Backup</h1>
        <p>
          Download ordinary CSV files that can be opened in Numbers or Excel.
          Exporting never changes your cellar.
        </p>
      </header>

      <section className="backup-list" aria-label="Available exports">
        {exports.map((item) => (
          <article key={item.href}>
            <div>
              <h2>{item.title}</h2>
              <p>{item.copy}</p>
            </div>
            <a className="backup-download" href={item.href} download>
              Download CSV
            </a>
          </article>
        ))}
      </section>

      <aside className="backup-note">
        <strong>Keep these files private.</strong>
        <p>They contain your personal cellar history. Photograph links work only while you are signed in.</p>
      </aside>
    </main>
  );
}

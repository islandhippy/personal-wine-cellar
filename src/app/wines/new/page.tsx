import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddWineForm } from "./add-wine-form";

export const metadata = {
  title: "Add Wine",
};

export default async function AddWinePage() {
  const supabase = await createClient();
  const { data: shelves } = await supabase
    .from("shelves")
    .select("id, name")
    .eq("is_active", true)
    .order("position");

  return (
    <main className="form-shell">
      <header className="form-header">
        <Link className="back-link" href="/">
          <span aria-hidden="true">←</span> My Cellar
        </Link>
        <p className="eyebrow">New cellar entry</p>
        <h1 className="form-title">Add Wine</h1>
        <p>
          Start with the label and what you know. Everything except the front
          photograph can be completed later.
        </p>
      </header>
      <AddWineForm shelves={shelves ?? []} />
    </main>
  );
}

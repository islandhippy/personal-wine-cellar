import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type CellarWine = {
  id: string;
  producer: string | null;
  name: string | null;
  vintage_year: number | null;
  current_quantity: number;
  region: string | null;
  drink_from_year: number | null;
  drink_until_year: number | null;
  shelves: { name: string }[];
};

function wineTitle(wine: CellarWine) {
  return [wine.producer, wine.name].filter(Boolean).join(" · ") || "Untitled wine";
}

function drinkingWindow(wine: CellarWine) {
  if (wine.drink_from_year && wine.drink_until_year) {
    return `${wine.drink_from_year}–${wine.drink_until_year}`;
  }
  if (wine.drink_from_year) return `From ${wine.drink_from_year}`;
  if (wine.drink_until_year) return `By ${wine.drink_until_year}`;
  return "No window set";
}

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wines")
    .select(
      "id, producer, name, vintage_year, current_quantity, region, drink_from_year, drink_until_year, shelves(name)",
    )
    .eq("status", "active")
    .gt("current_quantity", 0)
    .order("updated_at", { ascending: false });

  const wines = (data ?? []) as CellarWine[];
  const bottleCount = wines.reduce(
    (total, wine) => total + wine.current_quantity,
    0,
  );

  return (
    <main className="cellar-shell">
      <header className="cellar-header">
        <div>
          <p className="eyebrow">Personal Wine Cellar</p>
          <h1 className="cellar-title">My Cellar</h1>
          <p className="cellar-count" aria-live="polite">
            {bottleCount} {bottleCount === 1 ? "bottle" : "bottles"}
            <span aria-hidden="true"> · </span>
            {wines.length} {wines.length === 1 ? "wine" : "wines"}
          </p>
        </div>
        <Link className="profile-link" href="/security/passkeys">
          <span aria-hidden="true">PT</span>
          <span className="visually-hidden">Face ID and security</span>
        </Link>
      </header>

      <nav className="cellar-actions" aria-label="Cellar actions">
        <Link href="/">
          <span className="action-symbol" aria-hidden="true">≡</span>
          <span>All Wines</span>
        </Link>
        <Link href="/drink-soon">
          <span className="action-symbol" aria-hidden="true">◷</span>
          <span>Drink Soon</span>
        </Link>
        <Link className="add-wine-action" href="/wines/new">
          <span className="action-symbol" aria-hidden="true">＋</span>
          <span>Add Wine</span>
        </Link>
        <Link href="/search">
          <span className="action-symbol search-symbol" aria-hidden="true" />
          <span>Search</span>
        </Link>
      </nav>

      {error ? (
        <section className="cellar-message" role="alert">
          <p className="message-kicker">Cellar unavailable</p>
          <h2>Your wines could not be loaded.</h2>
          <p>Please refresh the page. Your cellar data has not been changed.</p>
        </section>
      ) : wines.length === 0 ? (
        <section className="cellar-message empty-cellar">
          <div className="bottle-outline" aria-hidden="true">
            <span />
          </div>
          <p className="message-kicker">Your EuroCave is ready</p>
          <h2>Begin your cellar</h2>
          <p>
            Add your first wine and its label photograph. Shelf 1 is at the top
            of the fridge.
          </p>
          <Link className="primary-link" href="/wines/new">
            Add your first wine
          </Link>
        </section>
      ) : (
        <section className="wine-list" aria-labelledby="wine-list-title">
          <div className="section-heading">
            <h2 id="wine-list-title">Your wines</h2>
            <span>Recently updated</span>
          </div>
          <ul>
            {wines.map((wine) => (
              <li key={wine.id}>
                <Link className="wine-row" href={`/wines/${wine.id}`}>
                  <div className="label-placeholder" aria-hidden="true">
                    <span>{wine.producer?.slice(0, 1) ?? "W"}</span>
                  </div>
                  <div className="wine-row-copy">
                    <p className="wine-name">{wineTitle(wine)}</p>
                    <p className="wine-vintage">
                      {wine.vintage_year ?? "NV"}
                      {wine.region ? ` · ${wine.region}` : ""}
                    </p>
                    <p className="wine-meta">
                      {drinkingWindow(wine)}
                      {wine.shelves[0]?.name ? ` · ${wine.shelves[0].name}` : ""}
                    </p>
                  </div>
                  <div className="wine-quantity">
                    <strong>{wine.current_quantity}</strong>
                    <span>{wine.current_quantity === 1 ? "bottle" : "bottles"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

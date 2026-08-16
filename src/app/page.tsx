import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { thumbnailPath } from "@/lib/images/prepare-label";
import { WINE_TYPES, type WineType } from "@/lib/wine-types";

type CellarWine = {
  id: string;
  producer: string | null;
  name: string | null;
  vintage_year: number | null;
  current_quantity: number;
  country: string | null;
  wine_type: WineType | null;
  purchase_price_pence: number | null;
  wine_images: { image_type: "front" | "back"; storage_path: string }[] | null;
};

type ChartItem = {
  label: string;
  value: number;
  color: string;
  href?: string;
};

const TYPE_COLORS: Record<string, string> = {
  Red: "#78283e",
  White: "#d8b96c",
  Rosé: "#d88d94",
  Sparkling: "#a89b72",
  Sweet: "#c78a38",
  Fortified: "#7b5443",
  "Not set": "#cfc4b5",
};

const COUNTRY_COLORS = ["#6f2438", "#9b5d4c", "#b9835a", "#7c7761", "#a99b83", "#d5c9b8"];

function wineTitle(wine: CellarWine) {
  return [wine.name, wine.producer].filter(Boolean).join(" · ") || "Untitled wine";
}

function pounds(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

function searchLink(name: "type" | "country", value: string) {
  return `/search?${name}=${encodeURIComponent(value)}`;
}

function DonutChart({ items, title, total }: { items: ChartItem[]; title: string; total: number }) {
  const stops = items.map((item, index) => {
    const preceding = items.slice(0, index).reduce((sum, entry) => sum + entry.value, 0);
    const start = total ? (preceding / total) * 100 : 0;
    const end = total ? ((preceding + item.value) / total) * 100 : 0;
    return `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });

  return (
    <article className="overview-chart">
      <div
        aria-label={`${title}: ${items.map((item) => `${item.label}, ${item.value} bottles`).join("; ")}`}
        className="donut-chart"
        role="img"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      >
        <div><strong>{total}</strong><span>bottles</span></div>
      </div>
      <div className="chart-copy">
        <h2>{title}</h2>
        <ul className="chart-legend">
          {items.map((item) => (
            <li key={item.label}>
              {item.href ? (
                <Link href={item.href}>
                  <i style={{ background: item.color }} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </Link>
              ) : (
                <span>
                  <i style={{ background: item.color }} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wines")
    .select("id, producer, name, vintage_year, current_quantity, country, wine_type, purchase_price_pence, wine_images(image_type, storage_path)")
    .eq("status", "active")
    .gt("current_quantity", 0)
    .order("updated_at", { ascending: false });

  const wines = (data ?? []) as unknown as CellarWine[];
  const bottleCount = wines.reduce((total, wine) => total + wine.current_quantity, 0);

  const typeBottles = new Map<string, number>();
  const countryBottles = new Map<string, number>();
  const countryWines = new Map<string, number>();
  for (const wine of wines) {
    const type = wine.wine_type ?? "Not set";
    const country = wine.country?.trim() || "Not set";
    typeBottles.set(type, (typeBottles.get(type) ?? 0) + wine.current_quantity);
    countryBottles.set(country, (countryBottles.get(country) ?? 0) + wine.current_quantity);
    countryWines.set(country, (countryWines.get(country) ?? 0) + 1);
  }

  const typeOrder = [...WINE_TYPES, "Not set"];
  const typeItems: ChartItem[] = typeOrder.flatMap((label) => {
    const value = typeBottles.get(label) ?? 0;
    return value ? [{ label, value, color: TYPE_COLORS[label], href: label === "Not set" ? undefined : searchLink("type", label) }] : [];
  });

  const countryRanks = [...countryBottles.entries()].sort((a, b) => b[1] - a[1]);
  const leadingCountries = countryRanks.slice(0, 5);
  const otherCountries = countryRanks.slice(5);
  const countryItems: ChartItem[] = leadingCountries.map(([label, value], index) => ({
    label,
    value,
    color: COUNTRY_COLORS[index],
    href: label === "Not set" ? undefined : searchLink("country", label),
  }));
  if (otherCountries.length) {
    countryItems.push({
      label: "Other",
      value: otherCountries.reduce((sum, [, value]) => sum + value, 0),
      color: COUNTRY_COLORS[5],
    });
  }

  const specialWines = wines
    .filter((wine) => (wine.purchase_price_pence ?? 0) > 3000)
    .sort((a, b) => (b.purchase_price_pence ?? 0) - (a.purchase_price_pence ?? 0))
    .slice(0, 4);
  const specialPaths = specialWines.map((wine) => {
    const path = wine.wine_images?.find((image) => image.image_type === "front")?.storage_path;
    return path ? thumbnailPath(path) : null;
  });
  const signablePaths = specialPaths.filter((path): path is string => Boolean(path));
  const { data: signedImages } = signablePaths.length
    ? await supabase.storage.from("wine-labels").createSignedUrls(signablePaths, 3600)
    : { data: [] };
  const signedUrl = new Map((signedImages ?? []).map((image) => [image.path, image.signedUrl]));

  const lessCommonCountries = [...countryWines.entries()]
    .filter(([country, count]) => country !== "Not set" && count <= 2)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));

  return (
    <main className="cellar-shell overview-shell">
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
        <Link href="/search"><span className="action-symbol search-symbol" aria-hidden="true" /><span>Find Wine</span></Link>
        <Link href="/drink-soon"><span className="action-symbol" aria-hidden="true">◷</span><span>Drink Soon</span></Link>
        <Link className="add-wine-action" href="/wines/new"><span className="action-symbol" aria-hidden="true">＋</span><span>Add Wine</span></Link>
      </nav>

      <Link className="overview-search" href="/search">
        <span className="search-symbol" aria-hidden="true" />
        <span><strong>Search My Cellar</strong><small>Wine, producer, country, type, vintage or shelf</small></span>
        <b aria-hidden="true">›</b>
      </Link>

      {error ? (
        <section className="cellar-message" role="alert">
          <p className="message-kicker">Cellar unavailable</p>
          <h2>Your overview could not be loaded.</h2>
          <p>Please refresh the page. Your cellar data has not been changed.</p>
        </section>
      ) : wines.length === 0 ? (
        <section className="cellar-message empty-cellar">
          <p className="message-kicker">Your EuroCave is ready</p>
          <h2>Begin your cellar</h2>
          <Link className="primary-link" href="/wines/new">Add your first wine</Link>
        </section>
      ) : (
        <div className="overview-content">
          <section className="overview-charts" aria-label="Collection overview">
            <DonutChart items={typeItems} title="Wine types" total={bottleCount} />
            <DonutChart items={countryItems} title="Countries" total={bottleCount} />
          </section>

          <section className="overview-section" aria-labelledby="special-title">
            <div className="overview-heading">
              <div><p className="eyebrow">Highlights</p><h2 id="special-title">Special bottles</h2></div>
              <span>Recorded above £30</span>
            </div>
            {specialWines.length ? (
              <div className="special-wines">
                {specialWines.map((wine, index) => (
                  <Link href={`/wines/${wine.id}`} key={wine.id}>
                    {specialPaths[index] && signedUrl.get(specialPaths[index]!) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={signedUrl.get(specialPaths[index]!)!} />
                    ) : <div className="special-label-placeholder" aria-hidden="true">{wine.name?.slice(0, 1) ?? "W"}</div>}
                    <div><h3>{wineTitle(wine)}</h3><p>{wine.vintage_year ?? "NV"} · {pounds(wine.purchase_price_pence!)}</p></div>
                  </Link>
                ))}
              </div>
            ) : <p className="overview-empty">Add purchase prices to reveal special bottles here.</p>}
          </section>

          <section className="overview-section" aria-labelledby="unusual-title">
            <div className="overview-heading">
              <div><p className="eyebrow">Explore</p><h2 id="unusual-title">Less common in my cellar</h2></div>
              <span>One or two wines</span>
            </div>
            {lessCommonCountries.length ? (
              <div className="unusual-countries">
                {lessCommonCountries.map(([country, count]) => (
                  <Link href={searchLink("country", country)} key={country}>
                    <span>{country}</span><strong>{count} {count === 1 ? "wine" : "wines"}</strong><b aria-hidden="true">›</b>
                  </Link>
                ))}
              </div>
            ) : <p className="overview-empty">Your country collection is evenly represented.</p>}
          </section>
        </div>
      )}
    </main>
  );
}

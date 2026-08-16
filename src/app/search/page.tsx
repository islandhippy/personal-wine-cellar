import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { thumbnailPath } from "@/lib/images/prepare-label";

export const metadata = { title: "Search" };

type SearchParams = {
  q?: string | string[];
  region?: string | string[];
  vintage?: string | string[];
  shelf?: string | string[];
};

type SearchWine = {
  id: string;
  producer: string | null;
  name: string | null;
  vintage_year: number | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  current_quantity: number;
  shelves: { id: string; name: string } | { id: string; name: string }[] | null;
  wine_images: { image_type: "front" | "back"; storage_path: string }[] | null;
  wine_grape_varieties:
    | { grape_varieties: { name: string } | { name: string }[] | null }[]
    | null;
};

function parameter(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function shelf(wine: SearchWine) {
  if (!wine.shelves) return null;
  return Array.isArray(wine.shelves) ? wine.shelves[0] ?? null : wine.shelves;
}

function grapes(wine: SearchWine) {
  return (wine.wine_grape_varieties ?? []).flatMap((row) => {
    const grape = row.grape_varieties;
    return Array.isArray(grape) ? grape.map((item) => item.name) : grape?.name ?? [];
  });
}

function title(wine: SearchWine) {
  return [wine.name, wine.producer].filter(Boolean).join(" · ") || "Untitled wine";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = parameter(params.q).trim();
  const selectedRegion = parameter(params.region);
  const selectedVintage = parameter(params.vintage);
  const selectedShelf = parameter(params.shelf);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wines")
    .select(
      "id, producer, name, vintage_year, country, region, appellation, current_quantity, shelves(id, name), wine_images(image_type, storage_path), wine_grape_varieties(grape_varieties(name))",
    )
    .eq("status", "active")
    .gt("current_quantity", 0)
    .order("producer", { ascending: true, nullsFirst: false });

  const allWines = (data ?? []) as unknown as SearchWine[];
  const regions = [...new Set(allWines.flatMap((wine) => (wine.region ? [wine.region] : [])))].sort(
    (a, b) => a.localeCompare(b),
  );
  const vintages = [...new Set(allWines.map((wine) => wine.vintage_year))].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return b - a;
  });
  const shelves = [
    ...new Map(
      allWines.flatMap((wine) => {
        const location = shelf(wine);
        return location ? [[location.id, location] as const] : [];
      }),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const normalizedQuery = query.toLocaleLowerCase();
  const wines = allWines.filter((wine) => {
    const searchable = [
      wine.producer,
      wine.name,
      wine.vintage_year?.toString(),
      wine.country,
      wine.region,
      wine.appellation,
      ...grapes(wine),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    const location = shelf(wine);

    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (!selectedRegion || wine.region === selectedRegion) &&
      (!selectedVintage ||
        (selectedVintage === "nv"
          ? wine.vintage_year === null
          : wine.vintage_year?.toString() === selectedVintage)) &&
      (!selectedShelf || location?.id === selectedShelf)
    );
  });

  const frontPaths = wines.map((wine) => {
    const path = wine.wine_images?.find((image) => image.image_type === "front")?.storage_path;
    return path ? thumbnailPath(path) : null;
  });
  const signablePaths = frontPaths.filter((path): path is string => Boolean(path));
  const { data: signedImages } = signablePaths.length
    ? await supabase.storage.from("wine-labels").createSignedUrls(signablePaths, 3600)
    : { data: [] };
  const signedUrl = new Map(
    (signedImages ?? []).map((image) => [image.path, image.signedUrl]),
  );
  const filtersApplied = Boolean(query || selectedRegion || selectedVintage || selectedShelf);

  return (
    <main className="search-shell">
      <header className="search-header">
        <Link className="back-link" href="/">
          <span aria-hidden="true">←</span> My Cellar
        </Link>
        <p className="eyebrow">Find a bottle</p>
        <h1>Search</h1>
      </header>

      <form className="search-form" method="get">
        <label className="search-box">
          <span className="search-symbol" aria-hidden="true" />
          <span className="visually-hidden">Search your wines</span>
          <input
            autoCapitalize="none"
            autoComplete="off"
            defaultValue={query}
            name="q"
            placeholder="Producer, wine, region, grape…"
            type="search"
          />
        </label>
        <div className="search-filters">
          <label>
            <span>Region</span>
            <select defaultValue={selectedRegion} name="region">
              <option value="">All regions</option>
              {regions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </label>
          <label>
            <span>Vintage</span>
            <select defaultValue={selectedVintage} name="vintage">
              <option value="">All vintages</option>
              {vintages.map((vintage) => (
                <option key={vintage ?? "nv"} value={vintage ?? "nv"}>{vintage ?? "NV"}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Shelf</span>
            <select defaultValue={selectedShelf} name="shelf">
              <option value="">All shelves</option>
              {shelves.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label>
        </div>
        <div className="search-submit-row">
          <button type="submit">Search My Cellar</button>
          {filtersApplied ? <Link href="/search">Clear</Link> : null}
        </div>
      </form>

      <section className="search-results" aria-labelledby="results-title">
        <div className="search-results-heading">
          <h2 id="results-title">{filtersApplied ? "Results" : "All wines"}</h2>
          <span>{wines.length} {wines.length === 1 ? "wine" : "wines"}</span>
        </div>

        {error ? (
          <p className="search-empty" role="alert">Your cellar could not be searched. Please try again.</p>
        ) : wines.length === 0 ? (
          <div className="search-empty">
            <h3>No matching wine</h3>
            <p>Try a broader search or clear one of the filters.</p>
          </div>
        ) : (
          <ol>
            {wines.map((wine, index) => {
              const location = shelf(wine);
              const path = frontPaths[index];
              return (
                <li key={wine.id}>
                  <Link href={`/wines/${wine.id}`}>
                    {path && signedUrl.get(path) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={signedUrl.get(path)!} alt="" />
                    ) : (
                      <div className="search-label-placeholder" aria-hidden="true">
                        {wine.producer?.slice(0, 1) ?? "W"}
                      </div>
                    )}
                    <div className="search-result-copy">
                      <h3>{title(wine)}</h3>
                      <p>{wine.vintage_year ?? "NV"}{wine.region ? ` · ${wine.region}` : ""}</p>
                      <span>{grapes(wine).join(", ") || wine.appellation || wine.country || "No further details"}</span>
                    </div>
                    <div className="search-result-balance">
                      <strong>{wine.current_quantity}</strong>
                      <span>{location?.name ?? "No shelf"}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}

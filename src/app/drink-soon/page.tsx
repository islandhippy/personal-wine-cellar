import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { thumbnailPath } from "@/lib/images/prepare-label";

export const metadata = { title: "Drink Soon" };

type Status = "beyond" | "approaching" | "in-window" | "not-yet";
type DrinkSoonWine = {
  id: string;
  producer: string | null;
  name: string | null;
  vintage_year: number | null;
  region: string | null;
  current_quantity: number;
  drink_from_year: number | null;
  drink_until_year: number | null;
  shelves: { name: string } | { name: string }[] | null;
  wine_images: { image_type: "front" | "back"; storage_path: string }[] | null;
};

const SECTION_COPY: Record<
  Status,
  { title: string; eyebrow: string; description: string }
> = {
  beyond: {
    eyebrow: "Consider first",
    title: "Beyond the suggested window",
    description:
      "These bottles may still be very enjoyable. Their suggested window has simply ended.",
  },
  approaching: {
    eyebrow: "Worth attention",
    title: "Approaching the end",
    description: "Their suggested window ends this year or within the following two years.",
  },
  "in-window": {
    eyebrow: "Ready when you are",
    title: "In the drinking window",
    description: "These bottles are within their suggested window with no immediate urgency.",
  },
  "not-yet": {
    eyebrow: "Leave for later",
    title: "Not yet in the window",
    description: "Their suggested drinking window begins in a future year.",
  },
};

function status(wine: DrinkSoonWine, year: number): Status {
  if (wine.drink_from_year !== null && wine.drink_from_year > year) return "not-yet";
  if (wine.drink_until_year !== null && wine.drink_until_year < year) return "beyond";
  if (
    wine.drink_until_year !== null &&
    wine.drink_until_year >= year &&
    wine.drink_until_year <= year + 2
  ) {
    return "approaching";
  }
  return "in-window";
}

function shelfName(wine: DrinkSoonWine) {
  if (!wine.shelves) return null;
  return Array.isArray(wine.shelves) ? wine.shelves[0]?.name ?? null : wine.shelves.name;
}

function title(wine: DrinkSoonWine) {
  return [wine.name, wine.producer].filter(Boolean).join(" · ") || "Untitled wine";
}

function windowText(wine: DrinkSoonWine) {
  if (wine.drink_from_year !== null && wine.drink_until_year !== null) {
    return `${wine.drink_from_year}–${wine.drink_until_year}`;
  }
  if (wine.drink_from_year !== null) return `From ${wine.drink_from_year}`;
  if (wine.drink_until_year !== null) return `By ${wine.drink_until_year}`;
  return "No window";
}

export default async function DrinkSoonPage() {
  const currentYear = new Date().getFullYear();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wines")
    .select(
      "id, producer, name, vintage_year, region, current_quantity, drink_from_year, drink_until_year, shelves(name), wine_images(image_type, storage_path)",
    )
    .eq("status", "active")
    .gt("current_quantity", 0);

  const allWines = (data ?? []) as unknown as DrinkSoonWine[];
  const withoutWindow = allWines.filter(
    (wine) => wine.drink_from_year === null && wine.drink_until_year === null,
  );
  const withWindow = allWines
    .filter((wine) => wine.drink_from_year !== null || wine.drink_until_year !== null)
    .sort((a, b) => {
      const aEnd = a.drink_until_year ?? Number.MAX_SAFE_INTEGER;
      const bEnd = b.drink_until_year ?? Number.MAX_SAFE_INTEGER;
      if (aEnd !== bEnd) return aEnd - bEnd;
      return (a.drink_from_year ?? 0) - (b.drink_from_year ?? 0);
    });
  const sections = (["beyond", "approaching", "in-window", "not-yet"] as Status[])
    .map((key) => ({ key, wines: withWindow.filter((wine) => status(wine, currentYear) === key) }))
    .filter((section) => section.wines.length > 0);

  const imagePaths = withWindow.map((wine) => {
    const path = wine.wine_images?.find((image) => image.image_type === "front")?.storage_path;
    return path ? thumbnailPath(path) : null;
  });
  const signablePaths = imagePaths.filter((path): path is string => Boolean(path));
  const { data: signedImages } = signablePaths.length
    ? await supabase.storage.from("wine-labels").createSignedUrls(signablePaths, 3600)
    : { data: [] };
  const signedUrl = new Map(
    (signedImages ?? []).map((image) => [image.path, image.signedUrl]),
  );
  const imagePathByWine = new Map(
    withWindow.map((wine, index) => [wine.id, imagePaths[index]]),
  );

  return (
    <main className="soon-shell">
      <header className="soon-header">
        <Link className="back-link" href="/">
          <span aria-hidden="true">←</span> My Cellar
        </Link>
        <p className="eyebrow">Drinking windows</p>
        <h1>Drink Soon</h1>
        <p>
          A gentle guide to bottles worth considering—not a verdict on when a
          wine stops being enjoyable.
        </p>
      </header>

      <section className="soon-summary" aria-label="Drink Soon summary">
        <div><strong>{withWindow.length}</strong><span>with a window</span></div>
        <div><strong>{withoutWindow.length}</strong><span>without a window</span></div>
        <p>Based on {currentYear}</p>
      </section>

      {error ? (
        <section className="soon-empty" role="alert">
          <h2>Drinking windows could not be loaded.</h2>
          <p>Please refresh the page. Your cellar data has not been changed.</p>
        </section>
      ) : withWindow.length === 0 ? (
        <section className="soon-empty">
          <h2>No drinking windows yet</h2>
          <p>Add a drinking window while editing a wine and it will appear here.</p>
          <Link href="/">Return to My Cellar</Link>
        </section>
      ) : (
        <div className="soon-sections">
          {sections.map((section) => {
            const copy = SECTION_COPY[section.key];
            return (
              <section className={`soon-section status-${section.key}`} key={section.key}>
                <div className="soon-section-heading">
                  <p>{copy.eyebrow}</p>
                  <h2>{copy.title}</h2>
                  <span>{copy.description}</span>
                </div>
                <ol>
                  {section.wines.map((wine) => {
                    const imagePath = imagePathByWine.get(wine.id);
                    const location = shelfName(wine);
                    return (
                      <li key={wine.id}>
                        <Link href={`/wines/${wine.id}`}>
                          {imagePath && signedUrl.get(imagePath) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={signedUrl.get(imagePath)!} alt="" />
                          ) : (
                            <div className="soon-label-placeholder" aria-hidden="true">
                              {wine.producer?.slice(0, 1) ?? "W"}
                            </div>
                          )}
                          <div className="soon-wine-copy">
                            <h3>{title(wine)}</h3>
                            <p>{wine.vintage_year ?? "NV"}{wine.region ? ` · ${wine.region}` : ""}</p>
                            <span>{location ?? "Shelf not set"}</span>
                          </div>
                          <div className="soon-window">
                            <strong>{windowText(wine)}</strong>
                            <span>{wine.current_quantity} {wine.current_quantity === 1 ? "bottle" : "bottles"}</span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}

      {withoutWindow.length ? (
        <aside className="window-missing-note">
          <p>
            {withoutWindow.length} {withoutWindow.length === 1 ? "wine has" : "wines have"} no drinking window and {withoutWindow.length === 1 ? "is" : "are"} not ranked here.
          </p>
          <Link href="/search">Find wines to update <span aria-hidden="true">→</span></Link>
        </aside>
      ) : null}
    </main>
  );
}

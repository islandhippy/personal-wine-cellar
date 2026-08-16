import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WineActions } from "./wine-actions";
import type { WineType } from "@/lib/wine-types";

type Wine = {
  id: string;
  producer: string | null;
  name: string | null;
  vintage_year: number | null;
  bottle_size_ml: number;
  country: string | null;
  region: string | null;
  appellation: string | null;
  wine_type: WineType | null;
  current_quantity: number;
  drink_from_year: number | null;
  drink_until_year: number | null;
  shelf_id: string | null;
  source: string | null;
  purchase_price_pence: number | null;
  cellar_notes: string | null;
};

type DrinkingEvent = {
  id: string;
  drank_at: string;
  rating: number | null;
  tasting_note: string | null;
  date_known: boolean;
};

type Transaction = {
  id: string;
  transaction_type: string;
  quantity_change: number;
  occurred_at: string;
  unit_price_pence: number | null;
  source: string | null;
  note: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function transactionName(value: string) {
  return {
    initial_inventory: "Initial inventory",
    purchased: "Purchased",
    gift: "Gift",
    other_acquisition: "Added",
    drank: "Drank one",
    manual_adjustment: "Manual adjustment",
  }[value] ?? value;
}

function displayPrice(pence: number | null) {
  if (pence === null) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("wines")
    .select("producer, name, vintage_year")
    .eq("id", id)
    .maybeSingle();
  const title = [data?.name, data?.producer, data?.vintage_year ?? "NV"]
    .filter(Boolean)
    .join(" ");
  return { title: title || "Wine Detail" };
}

export default async function WineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: wineData, error } = await supabase
    .from("wines")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !wineData) notFound();
  const wine = wineData as Wine;

  const [shelfResult, imageResult, grapeResult, eventResult, transactionResult] =
    await Promise.all([
      wine.shelf_id
        ? supabase.from("shelves").select("name").eq("id", wine.shelf_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("wine_images")
        .select("image_type, storage_path")
        .eq("wine_id", id),
      supabase
        .from("wine_grape_varieties")
        .select("grape_varieties(name)")
        .eq("wine_id", id),
      supabase
        .from("drinking_events")
        .select("id, drank_at, rating, tasting_note, date_known")
        .eq("wine_id", id)
        .order("drank_at", { ascending: false }),
      supabase
        .from("inventory_transactions")
        .select(
          "id, transaction_type, quantity_change, occurred_at, unit_price_pence, source, note",
        )
        .eq("wine_id", id)
        .order("occurred_at", { ascending: false }),
    ]);

  const images = (imageResult.data ?? []) as {
    image_type: "front" | "back";
    storage_path: string;
  }[];
  const { data: signedImages } = images.length
    ? await supabase.storage
        .from("wine-labels")
        .createSignedUrls(images.map((image) => image.storage_path), 3600)
    : { data: [] };
  const imageUrl = new Map(
    (signedImages ?? []).map((image) => [image.path, image.signedUrl]),
  );
  const frontImage = images.find((image) => image.image_type === "front");
  const backImage = images.find((image) => image.image_type === "back");

  const grapes = (grapeResult.data ?? [])
    .flatMap((row) => {
      const grape = row.grape_varieties as
        | { name: string }
        | { name: string }[]
        | null;
      return Array.isArray(grape) ? grape.map((item) => item.name) : grape?.name ?? [];
    })
    .filter(Boolean);
  const events = (eventResult.data ?? []) as DrinkingEvent[];
  const transactions = (transactionResult.data ?? []) as Transaction[];
  const ratings = events.flatMap((event) =>
    event.rating === null ? [] : [event.rating],
  );
  const averageRating = ratings.length
    ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
    : null;
  const identity = [wine.country, wine.region, wine.appellation]
    .filter(Boolean)
    .join(" · ");
  const title = [wine.name, wine.producer].filter(Boolean).join(" · ") || "Untitled wine";

  return (
    <main className="wine-detail-shell">
      <header className="detail-topbar">
        <Link className="back-link" href="/">
          <span aria-hidden="true">←</span> My Cellar
        </Link>
        <Link className="detail-edit-link" href={`/wines/${id}/edit`}>
          Edit
        </Link>
      </header>

      <section className="wine-hero">
        <div className="detail-labels">
          {frontImage && imageUrl.get(frontImage.storage_path) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="detail-label-image"
              src={imageUrl.get(frontImage.storage_path)!}
              alt={`Front label of ${title}`}
            />
          ) : (
            <div className="detail-label-missing">No front label</div>
          )}
          {backImage && imageUrl.get(backImage.storage_path) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="detail-back-label"
              src={imageUrl.get(backImage.storage_path)!}
              alt={`Back label of ${title}`}
            />
          ) : null}
        </div>

        <div className="wine-heading-copy">
          <p className="eyebrow">{wine.vintage_year ?? "Non-vintage"}</p>
          <h1>{title}</h1>
          {identity ? <p className="wine-origin">{identity}</p> : null}
          <p className="wine-bottle-size">
            {wine.bottle_size_ml === 375 ? "½ bottle · 37.5cl" : "Standard bottle · 75cl"}
          </p>
        </div>
      </section>

      <section className="detail-balance" aria-label="Current cellar balance">
        <div>
          <strong>{wine.current_quantity}</strong>
          <span>{wine.current_quantity === 1 ? "bottle" : "bottles"}</span>
        </div>
        <dl>
          <div>
            <dt>Shelf</dt>
            <dd>{shelfResult.data?.name ?? "Not set"}</dd>
          </div>
          <div>
            <dt>Drinking window</dt>
            <dd>
              {wine.drink_from_year || wine.drink_until_year
                ? `${wine.drink_from_year ?? "Now"}–${wine.drink_until_year ?? "Open"}`
                : "Not set"}
            </dd>
          </div>
        </dl>
      </section>

      <WineActions quantity={wine.current_quantity} wineId={wine.id} />

      <div className="detail-columns">
        <section className="detail-section" aria-labelledby="details-title">
          <h2 id="details-title">Cellar notes</h2>
          {wine.cellar_notes ? (
            <p className="cellar-note-copy">{wine.cellar_notes}</p>
          ) : (
            <p className="quiet-copy">No personal notes yet.</p>
          )}
          <dl className="wine-facts">
            {wine.wine_type ? <div><dt>Wine type</dt><dd>{wine.wine_type}</dd></div> : null}
            {grapes.length ? <div><dt>Grapes</dt><dd>{grapes.join(", ")}</dd></div> : null}
            {wine.source ? <div><dt>Source</dt><dd>{wine.source}</dd></div> : null}
            {wine.purchase_price_pence !== null ? (
              <div><dt>Purchase price</dt><dd>{displayPrice(wine.purchase_price_pence)} per bottle</dd></div>
            ) : null}
          </dl>
        </section>

        <section className="detail-section" aria-labelledby="ratings-title">
          <div className="detail-section-heading">
            <h2 id="ratings-title">Wine memories</h2>
            {averageRating !== null ? <span>{averageRating.toFixed(1)}/10 average</span> : null}
          </div>
          {events.length ? (
            <ol className="memory-list">
              {events.map((event) => (
                <li key={event.id}>
                  <div>
                    {event.date_known ? <time dateTime={event.drank_at}>{formatDate(event.drank_at)}</time> : <span className="unknown-date">Date unknown</span>}
                    {event.rating !== null ? <strong>{event.rating}/10</strong> : null}
                  </div>
                  {event.tasting_note ? <p>{event.tasting_note}</p> : <p className="quiet-copy">No tasting note.</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="quiet-copy">Your first tasting note will appear here.</p>
          )}
        </section>

        <section className="detail-section transaction-section" aria-labelledby="transactions-title">
          <h2 id="transactions-title">Inventory history</h2>
          <ol className="transaction-list">
            {transactions.map((transaction) => (
              <li key={transaction.id}>
                <span className={transaction.quantity_change > 0 ? "quantity-positive" : "quantity-negative"}>
                  {transaction.quantity_change > 0 ? "+" : ""}{transaction.quantity_change}
                </span>
                <div>
                  <strong>{transactionName(transaction.transaction_type)}</strong>
                  <p>
                    {formatDate(transaction.occurred_at)}
                    {transaction.source ? ` · ${transaction.source}` : ""}
                    {transaction.unit_price_pence !== null ? ` · ${displayPrice(transaction.unit_price_pence)} each` : ""}
                  </p>
                  {transaction.note ? <p>{transaction.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <Link className="learn-more-link" href={`/wines/${id}/learn-more`}>
        Learn More <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}

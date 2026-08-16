import { csvResponse, makeCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function relationName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return (value[0] as { name?: string } | undefined)?.name ?? "";
  return (value as { name?: string }).name ?? "";
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in required", { status: 401 });

  const file = new URL(request.url).searchParams.get("file");
  const stamp = today();

  if (file === "cellar") {
    const [{ data: wines, error }, { data: links, error: grapeError }] = await Promise.all([
      supabase.from("wines").select("*, shelves(name)").order("created_at"),
      supabase.from("wine_grape_varieties").select("wine_id, percentage, grape_varieties(name)"),
    ]);
    if (error || grapeError) return new Response("Export could not be prepared", { status: 500 });

    const grapes = new Map<string, string[]>();
    for (const link of links ?? []) {
      const name = relationName(link.grape_varieties);
      if (!name) continue;
      const label = link.percentage === null ? name : `${name} (${link.percentage}%)`;
      grapes.set(link.wine_id, [...(grapes.get(link.wine_id) ?? []), label]);
    }

    return csvResponse(`wine-cellar-${stamp}.csv`, makeCsv(
      ["wine_id", "producer", "wine_cuvee", "vintage", "bottle_size_ml", "country", "region", "appellation", "grapes", "current_quantity", "drink_from_year", "drink_until_year", "shelf", "source", "purchase_price_gbp", "cellar_notes", "status", "created_at", "modified_at"],
      (wines ?? []).map((wine) => [wine.id, wine.producer, wine.name, wine.vintage_year ?? "NV", wine.bottle_size_ml, wine.country, wine.region, wine.appellation, (grapes.get(wine.id) ?? []).join("; "), wine.current_quantity, wine.drink_from_year, wine.drink_until_year, relationName(wine.shelves), wine.source, wine.purchase_price_pence === null ? null : (wine.purchase_price_pence / 100).toFixed(2), wine.cellar_notes, wine.status, wine.created_at, wine.updated_at]),
    ));
  }

  if (file === "transactions") {
    const { data, error } = await supabase.from("inventory_transactions").select("*, wines(producer, name, vintage_year), shelves(name)").order("occurred_at");
    if (error) return new Response("Export could not be prepared", { status: 500 });
    return csvResponse(`wine-transactions-${stamp}.csv`, makeCsv(
      ["transaction_id", "wine_id", "producer", "wine_cuvee", "vintage", "occurred_at", "transaction_type", "quantity_change", "shelf", "unit_price_gbp", "source", "note", "drinking_event_id", "created_at"],
      (data ?? []).map((row) => { const wine = Array.isArray(row.wines) ? row.wines[0] : row.wines; return [row.id, row.wine_id, wine?.producer, wine?.name, wine?.vintage_year ?? "NV", row.occurred_at, row.transaction_type, row.quantity_change, relationName(row.shelves), row.unit_price_pence === null ? null : (row.unit_price_pence / 100).toFixed(2), row.source, row.note, row.drinking_event_id, row.created_at]; }),
    ));
  }

  if (file === "diary") {
    const { data, error } = await supabase.from("drinking_events").select("*, wines(producer, name, vintage_year, bottle_size_ml), shelves(name)").order("drank_at");
    if (error) return new Response("Export could not be prepared", { status: 500 });
    return csvResponse(`wine-diary-${stamp}.csv`, makeCsv(
      ["drinking_event_id", "wine_id", "producer", "wine_cuvee", "vintage", "bottle_size_ml", "drank_at", "rating_out_of_10", "tasting_note", "shelf", "created_at", "modified_at"],
      (data ?? []).map((row) => { const wine = Array.isArray(row.wines) ? row.wines[0] : row.wines; return [row.id, row.wine_id, wine?.producer, wine?.name, wine?.vintage_year ?? "NV", wine?.bottle_size_ml, row.drank_at, row.rating, row.tasting_note, relationName(row.shelves), row.created_at, row.updated_at]; }),
    ));
  }

  if (file === "photos") {
    const { data, error } = await supabase.from("wine_images").select("*, wines(producer, name, vintage_year)").order("created_at");
    if (error) return new Response("Export could not be prepared", { status: 500 });
    const origin = new URL(request.url).origin;
    return csvResponse(`wine-photographs-${stamp}.csv`, makeCsv(
      ["image_id", "wine_id", "producer", "wine_cuvee", "vintage", "image_type", "original_filename", "mime_type", "width", "height", "file_size_bytes", "storage_path", "private_download_link", "created_at", "modified_at"],
      (data ?? []).map((row) => { const wine = Array.isArray(row.wines) ? row.wines[0] : row.wines; return [row.id, row.wine_id, wine?.producer, wine?.name, wine?.vintage_year ?? "NV", row.image_type, row.original_filename, row.mime_type, row.width, row.height, row.file_size_bytes, row.storage_path, `${origin}/backup/photos/${row.id}`, row.created_at, row.updated_at]; }),
    ));
  }

  return new Response("Unknown export", { status: 400 });
}

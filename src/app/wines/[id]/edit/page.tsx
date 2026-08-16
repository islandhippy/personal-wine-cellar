import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditWineForm } from "./edit-wine-form";

export const metadata = { title: "Edit Wine" };

export default async function EditWinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: wine } = await supabase.from("wines").select("*").eq("id", id).maybeSingle();
  if (!wine) notFound();

  const [shelvesResult, grapesResult, imagesResult] = await Promise.all([
    supabase.from("shelves").select("id, name").eq("is_active", true).order("position"),
    supabase
      .from("wine_grape_varieties")
      .select("grape_varieties(name)")
      .eq("wine_id", id),
    supabase
      .from("wine_images")
      .select("image_type, storage_path")
      .eq("wine_id", id),
  ]);

  const grapeNames = (grapesResult.data ?? []).flatMap((row) => {
    const grape = row.grape_varieties as { name: string } | { name: string }[] | null;
    return Array.isArray(grape) ? grape.map((item) => item.name) : grape?.name ?? [];
  });
  const images = (imagesResult.data ?? []) as {
    image_type: "front" | "back";
    storage_path: string;
  }[];
  const { data: signedImages } = images.length
    ? await supabase.storage
        .from("wine-labels")
        .createSignedUrls(images.map((image) => image.storage_path), 3600)
    : { data: [] };
  const urlByPath = new Map(
    (signedImages ?? []).map((image) => [image.path, image.signedUrl]),
  );

  return (
    <main className="form-shell">
      <header className="form-header">
        <Link className="back-link" href={`/wines/${id}`}>
          <span aria-hidden="true">←</span> Wine Detail
        </Link>
        <p className="eyebrow">Cellar entry</p>
        <h1 className="form-title">Edit Wine</h1>
        <p>Correct or complete the details without changing its history.</p>
      </header>
      <EditWineForm
        grapes={grapeNames}
        images={images.map((image) => ({
          ...image,
          signedUrl: urlByPath.get(image.storage_path) ?? null,
        }))}
        shelves={shelvesResult.data ?? []}
        wine={wine}
      />
    </main>
  );
}

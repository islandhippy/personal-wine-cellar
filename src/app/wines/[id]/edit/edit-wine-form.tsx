"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { makeLabelJpeg, thumbnailPath } from "@/lib/images/prepare-label";
import { WINE_TYPES, type WineType } from "@/lib/wine-types";

type Shelf = { id: string; name: string };
type ImageKind = "front" | "back";
type StoredImage = {
  image_type: ImageKind;
  storage_path: string;
  signedUrl: string | null;
};
type Preview = { file: File; url: string };
type EditableWine = {
  id: string;
  user_id: string;
  producer: string | null;
  name: string | null;
  vintage_year: number | null;
  bottle_size_ml: number;
  country: string | null;
  region: string | null;
  appellation: string | null;
  wine_type: WineType | null;
  drink_from_year: number | null;
  drink_until_year: number | null;
  shelf_id: string | null;
  source: string | null;
  purchase_price_pence: number | null;
  cellar_notes: string | null;
};

function text(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").trim();
  return value || null;
}

function number(form: FormData, name: string) {
  const value = text(form, name);
  return value === null ? null : Number(value);
}

export function EditWineForm({
  wine,
  shelves,
  grapes,
  images,
}: {
  wine: EditableWine;
  shelves: Shelf[];
  grapes: string[];
  images: StoredImage[];
}) {
  const router = useRouter();
  const [front, setFront] = useState<Preview | null>(null);
  const [back, setBack] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const existingFront = images.find((image) => image.image_type === "front");
  const existingBack = images.find((image) => image.image_type === "back");

  function choose(
    event: ChangeEvent<HTMLInputElement>,
    current: Preview | null,
    setter: (value: Preview | null) => void,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (current) URL.revokeObjectURL(current.url);
    setter({ file, url: URL.createObjectURL(file) });
  }

  async function replaceImage(kind: ImageKind, preview: Preview, existing?: StoredImage) {
    const supabase = createClient();
    const key = crypto.randomUUID();
    const path = `${wine.user_id}/${wine.id}/${kind}-${key}.jpg`;
    const thumbPath = thumbnailPath(path);
    const original = await makeLabelJpeg(preview.file, 2400, 2400, 0.9);
    const thumbnail = await makeLabelJpeg(preview.file, 320, 440, 0.82, true);

    const { error: uploadError } = await supabase.storage
      .from("wine-labels")
      .upload(path, original.blob, { cacheControl: "31536000", contentType: "image/jpeg" });
    if (uploadError) throw uploadError;
    const { error: thumbError } = await supabase.storage
      .from("wine-labels")
      .upload(thumbPath, thumbnail.blob, { cacheControl: "31536000", contentType: "image/jpeg" });
    if (thumbError) {
      await supabase.storage.from("wine-labels").remove([path]);
      throw thumbError;
    }

    const metadata = {
      user_id: wine.user_id,
      wine_id: wine.id,
      image_type: kind,
      storage_path: path,
      original_filename: preview.file.name,
      mime_type: "image/jpeg",
      width: original.width,
      height: original.height,
      file_size_bytes: original.blob.size,
    };
    const metadataResult = existing
      ? await supabase
          .from("wine_images")
          .update(metadata)
          .eq("wine_id", wine.id)
          .eq("image_type", kind)
      : await supabase.from("wine_images").insert(metadata);

    if (metadataResult.error) {
      await supabase.storage.from("wine-labels").remove([path, thumbPath]);
      throw metadataResult.error;
    }

    if (existing) {
      await supabase.storage
        .from("wine-labels")
        .remove([existing.storage_path, thumbnailPath(existing.storage_path)]);
    }
  }

  async function replaceGrapes(value: string) {
    const supabase = createClient();
    const names = [...new Set(value.split(",").map((name) => name.trim()).filter(Boolean))];
    const { error: deleteError } = await supabase
      .from("wine_grape_varieties")
      .delete()
      .eq("wine_id", wine.id);
    if (deleteError) throw deleteError;

    for (const name of names) {
      const { data: existing } = await supabase
        .from("grape_varieties")
        .select("id")
        .eq("user_id", wine.user_id)
        .ilike("name", name)
        .maybeSingle();
      let grapeId = existing?.id;
      if (!grapeId) {
        const { data: created, error } = await supabase
          .from("grape_varieties")
          .insert({ user_id: wine.user_id, name })
          .select("id")
          .single();
        if (error) throw error;
        grapeId = created.id;
      }
      const { error } = await supabase.from("wine_grape_varieties").insert({
        user_id: wine.user_id,
        wine_id: wine.id,
        grape_variety_id: grapeId,
      });
      if (error) throw error;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Saving changes…");
    const form = new FormData(event.currentTarget);
    const price = number(form, "purchase_price");
    const { error } = await createClient()
      .from("wines")
      .update({
        producer: text(form, "producer"),
        name: text(form, "name"),
        vintage_year: number(form, "vintage_year"),
        bottle_size_ml: Number(form.get("bottle_size_ml") ?? 750),
        country: text(form, "country"),
        region: text(form, "region"),
        appellation: text(form, "appellation"),
        wine_type: text(form, "wine_type"),
        drink_from_year: number(form, "drink_from_year"),
        drink_until_year: number(form, "drink_until_year"),
        shelf_id: text(form, "shelf_id"),
        source: text(form, "source"),
        purchase_price_pence: price === null ? null : Math.round(price * 100),
        cellar_notes: text(form, "cellar_notes"),
      })
      .eq("id", wine.id);

    try {
      if (error) throw error;
      await replaceGrapes(String(form.get("grapes") ?? ""));
      if (front) await replaceImage("front", front, existingFront);
      if (back) await replaceImage("back", back, existingBack);
      router.push(`/wines/${wine.id}`);
      router.refresh();
    } catch {
      setMessage("Some changes could not be saved. Please try again before making further edits.");
      setBusy(false);
    }
  }

  function photo(kind: ImageKind, selected: Preview | null, existing?: StoredImage) {
    const source = selected?.url ?? existing?.signedUrl;
    return (
      <label className={`photo-field ${source ? "has-photo" : ""}`}>
        {source ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={source} alt={`${kind === "front" ? "Front" : "Back"} label`} />
        ) : (
          <span className="photo-prompt"><strong>＋</strong>{kind === "front" ? "Front label" : "Back label"}<small>Not set</small></span>
        )}
        <span className="replace-photo-copy">{source ? "Tap to replace" : "Tap to add"}</span>
        <input
          accept="image/*"
          aria-label={`${source ? "Replace" : "Add"} ${kind} label photograph`}
          onChange={(event) => choose(event, selected, kind === "front" ? setFront : setBack)}
          type="file"
        />
      </label>
    );
  }

  return (
    <form className="wine-form" onSubmit={submit}>
      <section className="form-section">
        <div className="form-section-heading"><p>1</p><div><h2>Labels</h2><span>Tap only if you want to replace a photograph.</span></div></div>
        <div className="photo-fields">{photo("front", front, existingFront)}{photo("back", back, existingBack)}</div>
        <p className="privacy-note">New photographs have GPS and device details removed.</p>
      </section>

      <section className="form-section">
        <div className="form-section-heading"><p>2</p><div><h2>The wine</h2><span>Correct or complete its identity.</span></div></div>
        <div className="field-grid">
          <label className="full-field"><span>Wine / cuvée</span><input defaultValue={wine.name ?? ""} name="name" /></label>
          <label className="full-field"><span>Producer</span><input defaultValue={wine.producer ?? ""} name="producer" /></label>
          <label><span>Vintage</span><input defaultValue={wine.vintage_year ?? ""} inputMode="numeric" max="2100" min="1000" name="vintage_year" placeholder="NV" type="number" /></label>
          <fieldset className="bottle-size-field"><legend>Bottle size</legend><div className="segmented-control"><label><input defaultChecked={wine.bottle_size_ml === 750} name="bottle_size_ml" type="radio" value="750" /><span>Standard</span></label><label><input defaultChecked={wine.bottle_size_ml === 375} name="bottle_size_ml" type="radio" value="375" /><span>½ bottle</span></label></div></fieldset>
          <label className="full-field"><span>Wine type</span><select defaultValue={wine.wine_type ?? ""} name="wine_type"><option value="">Not set</option>{WINE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label><span>Country</span><input defaultValue={wine.country ?? ""} name="country" /></label>
          <label><span>Region</span><input defaultValue={wine.region ?? ""} name="region" /></label>
          <label className="full-field"><span>Appellation</span><input defaultValue={wine.appellation ?? ""} name="appellation" /></label>
          <label className="full-field"><span>Grapes</span><input defaultValue={grapes.join(", ")} name="grapes" placeholder="Separate several grapes with commas" /></label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading"><p>3</p><div><h2>In the cellar</h2><span>Quantity is changed through Add Bottles or Drink One.</span></div></div>
        <div className="field-grid">
          <label><span>Shelf</span><select defaultValue={wine.shelf_id ?? ""} name="shelf_id"><option value="">Not set</option>{shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}</select></label>
          <label><span>Source</span><input defaultValue={wine.source ?? ""} name="source" /></label>
          <label><span>Drink from</span><input defaultValue={wine.drink_from_year ?? ""} inputMode="numeric" max="2200" min="1000" name="drink_from_year" placeholder="Year" type="number" /></label>
          <label><span>Drink by</span><input defaultValue={wine.drink_until_year ?? ""} inputMode="numeric" max="2200" min="1000" name="drink_until_year" placeholder="Year" type="number" /></label>
          <label><span>Price per bottle</span><span className="money-input"><b>£</b><input defaultValue={wine.purchase_price_pence === null ? "" : (wine.purchase_price_pence / 100).toFixed(2)} inputMode="decimal" min="0" name="purchase_price" placeholder="Optional" step="0.01" type="number" /></span></label>
          <label className="full-field"><span>Personal cellar notes</span><textarea defaultValue={wine.cellar_notes ?? ""} name="cellar_notes" rows={4} /></label>
        </div>
      </section>

      <div className="form-submit">
        {message ? <p role="status">{message}</p> : null}
        <button className="primary-action" disabled={busy} type="submit">{busy ? "Saving…" : "Save Changes"}</button>
      </div>
    </form>
  );
}

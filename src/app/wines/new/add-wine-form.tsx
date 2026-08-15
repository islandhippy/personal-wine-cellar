"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Shelf = { id: string; name: string };
type ImageKind = "front" | "back";
type Preview = { file: File; url: string };

function nullableText(data: FormData, name: string) {
  const value = String(data.get(name) ?? "").trim();
  return value || null;
}

function nullableNumber(data: FormData, name: string) {
  const value = nullableText(data, name);
  return value === null ? null : Number(value);
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This photograph could not be read."));
    };
    image.src = url;
  });
}

async function makeJpeg(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  thumbnail = false,
) {
  const image = await loadImage(file);
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = thumbnail ? maxWidth : width;
  canvas.height = thumbnail ? maxHeight : height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("This photograph could not be prepared.");

  context.fillStyle = "#f6f0e6";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    thumbnail ? Math.round((maxWidth - width) / 2) : 0,
    thumbnail ? Math.round((maxHeight - height) / 2) : 0,
    width,
    height,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("This photograph could not be prepared.");
  return { blob, width: canvas.width, height: canvas.height };
}

export function AddWineForm({ shelves }: { shelves: Shelf[] }) {
  const router = useRouter();
  const frontInput = useRef<HTMLInputElement>(null);
  const backInput = useRef<HTMLInputElement>(null);
  const [front, setFront] = useState<Preview | null>(null);
  const [back, setBack] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function selectImage(
    event: ChangeEvent<HTMLInputElement>,
    current: Preview | null,
    setter: (preview: Preview | null) => void,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (current) URL.revokeObjectURL(current.url);
    setter({ file, url: URL.createObjectURL(file) });
  }

  async function uploadImage(
    wineId: string,
    userId: string,
    kind: ImageKind,
    preview: Preview,
  ) {
    const supabase = createClient();
    const key = crypto.randomUUID();
    const originalPath = `${userId}/${wineId}/${kind}-${key}.jpg`;
    const thumbnailPath = `${userId}/${wineId}/${kind}-${key}-thumb.jpg`;
    const original = await makeJpeg(preview.file, 2400, 2400, 0.9);
    const thumbnail = await makeJpeg(preview.file, 320, 440, 0.82, true);

    const { error: originalError } = await supabase.storage
      .from("wine-labels")
      .upload(originalPath, original.blob, {
        cacheControl: "31536000",
        contentType: "image/jpeg",
        upsert: false,
      });
    if (originalError) throw originalError;

    const { error: thumbnailError } = await supabase.storage
      .from("wine-labels")
      .upload(thumbnailPath, thumbnail.blob, {
        cacheControl: "31536000",
        contentType: "image/jpeg",
        upsert: false,
      });
    if (thumbnailError) {
      await supabase.storage.from("wine-labels").remove([originalPath]);
      throw thumbnailError;
    }

    const { error: metadataError } = await supabase.from("wine_images").insert({
      user_id: userId,
      wine_id: wineId,
      image_type: kind,
      storage_path: originalPath,
      original_filename: preview.file.name,
      mime_type: "image/jpeg",
      width: original.width,
      height: original.height,
      file_size_bytes: original.blob.size,
    });

    if (metadataError) {
      await supabase.storage
        .from("wine-labels")
        .remove([originalPath, thumbnailPath]);
      throw metadataError;
    }
  }

  async function saveGrapes(wineId: string, userId: string, value: string) {
    const supabase = createClient();
    const names = [...new Set(value.split(",").map((name) => name.trim()).filter(Boolean))];

    for (const name of names) {
      const { data: existing } = await supabase
        .from("grape_varieties")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", name)
        .maybeSingle();

      let grapeId = existing?.id;
      if (!grapeId) {
        const { data: created, error } = await supabase
          .from("grape_varieties")
          .insert({ user_id: userId, name })
          .select("id")
          .single();
        if (error) throw error;
        grapeId = created.id;
      }

      const { error } = await supabase.from("wine_grape_varieties").insert({
        user_id: userId,
        wine_id: wineId,
        grape_variety_id: grapeId,
      });
      if (error) throw error;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!front) {
      setMessage("Please add a front-label photograph.");
      frontInput.current?.focus();
      return;
    }

    setBusy(true);
    setMessage("Saving your wine…");
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    let createdWineId: string | null = null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired. Please sign in again.");

      const pricePounds = nullableNumber(form, "purchase_price");
      const { data: wine, error } = await supabase
        .rpc("create_wine_with_initial_inventory", {
          p_producer: nullableText(form, "producer"),
          p_name: nullableText(form, "name"),
          p_vintage_year: nullableNumber(form, "vintage_year"),
          p_bottle_size_ml: Number(form.get("bottle_size_ml") ?? 750),
          p_country: nullableText(form, "country"),
          p_region: nullableText(form, "region"),
          p_appellation: nullableText(form, "appellation"),
          p_quantity: Number(form.get("quantity") ?? 1),
          p_drink_from_year: nullableNumber(form, "drink_from_year"),
          p_drink_until_year: nullableNumber(form, "drink_until_year"),
          p_shelf_id: nullableText(form, "shelf_id"),
          p_source: nullableText(form, "source"),
          p_purchase_price_pence:
            pricePounds === null ? null : Math.round(pricePounds * 100),
          p_cellar_notes: nullableText(form, "cellar_notes"),
        })
        .single();

      if (error || !wine) throw error ?? new Error("The wine could not be saved.");
      const wineId = (wine as { id: string }).id;
      createdWineId = wineId;

      await uploadImage(wineId, user.id, "front", front);
      if (back) await uploadImage(wineId, user.id, "back", back);

      const grapes = nullableText(form, "grapes");
      if (grapes) await saveGrapes(wineId, user.id, grapes);

      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(
        createdWineId
          ? "The wine was added, but part of its photograph or details could not be saved. Please do not add it again."
          : error instanceof Error
            ? error.message
            : "The wine could not be saved. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form className="wine-form" onSubmit={submit}>
      <section className="form-section photo-section" aria-labelledby="labels-heading">
        <div className="form-section-heading">
          <p>1</p>
          <div>
            <h2 id="labels-heading">Labels</h2>
            <span>Your photographs remain private.</span>
          </div>
        </div>
        <div className="photo-fields">
          <label className={`photo-field ${front ? "has-photo" : ""}`}>
            {front ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={front.url} alt="Selected front label" />
            ) : (
              <span className="photo-prompt">
                <strong>＋</strong>
                Front label
                <small>Required</small>
              </span>
            )}
            <input
              accept="image/*"
              aria-label="Choose or take a front-label photograph"
              onChange={(event) => selectImage(event, front, setFront)}
              ref={frontInput}
              type="file"
            />
          </label>
          <label className={`photo-field ${back ? "has-photo" : ""}`}>
            {back ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={back.url} alt="Selected back label" />
            ) : (
              <span className="photo-prompt">
                <strong>＋</strong>
                Back label
                <small>Optional</small>
              </span>
            )}
            <input
              accept="image/*"
              aria-label="Choose or take a back-label photograph"
              onChange={(event) => selectImage(event, back, setBack)}
              ref={backInput}
              type="file"
            />
          </label>
        </div>
        <p className="privacy-note">
          GPS and device details are removed before upload.
        </p>
      </section>

      <section className="form-section" aria-labelledby="wine-heading">
        <div className="form-section-heading">
          <p>2</p>
          <div>
            <h2 id="wine-heading">The wine</h2>
            <span>Add only what is useful now.</span>
          </div>
        </div>
        <div className="field-grid">
          <label className="full-field">
            <span>Producer</span>
            <input autoComplete="off" name="producer" placeholder="e.g. Château Musar" />
          </label>
          <label className="full-field">
            <span>Wine / cuvée</span>
            <input autoComplete="off" name="name" placeholder="Optional" />
          </label>
          <label>
            <span>Vintage</span>
            <input inputMode="numeric" max="2100" min="1000" name="vintage_year" placeholder="NV" type="number" />
          </label>
          <fieldset className="bottle-size-field">
            <legend>Bottle size</legend>
            <div className="segmented-control">
              <label><input defaultChecked name="bottle_size_ml" type="radio" value="750" /><span>Standard</span></label>
              <label><input name="bottle_size_ml" type="radio" value="375" /><span>½ bottle</span></label>
            </div>
          </fieldset>
          <label>
            <span>Country</span>
            <input autoComplete="off" name="country" />
          </label>
          <label>
            <span>Region</span>
            <input autoComplete="off" name="region" />
          </label>
          <label className="full-field">
            <span>Appellation</span>
            <input autoComplete="off" name="appellation" />
          </label>
          <label className="full-field">
            <span>Grapes</span>
            <input autoComplete="off" name="grapes" placeholder="Separate several grapes with commas" />
          </label>
        </div>
      </section>

      <section className="form-section" aria-labelledby="cellar-heading">
        <div className="form-section-heading">
          <p>3</p>
          <div>
            <h2 id="cellar-heading">In the cellar</h2>
            <span>Where it is and when to enjoy it.</span>
          </div>
        </div>
        <div className="field-grid">
          <label>
            <span>Quantity</span>
            <input defaultValue="1" inputMode="numeric" min="1" name="quantity" required type="number" />
          </label>
          <label>
            <span>Shelf</span>
            <select defaultValue="" name="shelf_id">
              <option value="">Not set</option>
              {shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}
            </select>
          </label>
          <label>
            <span>Drink from</span>
            <input inputMode="numeric" max="2200" min="1000" name="drink_from_year" placeholder="Year" type="number" />
          </label>
          <label>
            <span>Drink by</span>
            <input inputMode="numeric" max="2200" min="1000" name="drink_until_year" placeholder="Year" type="number" />
          </label>
          <label>
            <span>Source</span>
            <select defaultValue="existing collection" name="source">
              <option value="purchased">Purchased</option>
              <option value="gift">Gift</option>
              <option value="existing collection">Existing collection</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            <span>Price per bottle</span>
            <span className="money-input"><b>£</b><input inputMode="decimal" min="0" name="purchase_price" placeholder="Optional" step="0.01" type="number" /></span>
          </label>
          <label className="full-field">
            <span>Personal cellar notes</span>
            <textarea name="cellar_notes" placeholder="Anything worth remembering before you drink it" rows={4} />
          </label>
        </div>
      </section>

      <div className="form-submit">
        {message ? <p role="status">{message}</p> : null}
        <button className="primary-action" disabled={busy} type="submit">
          {busy ? "Adding wine…" : "Add to My Cellar"}
        </button>
      </div>
    </form>
  );
}

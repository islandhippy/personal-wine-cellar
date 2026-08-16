"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type OpenPanel = "drink" | "add" | "past" | null;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nullableText(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").trim();
  return value || null;
}

export function WineActions({ wineId, quantity }: { wineId: string; quantity: number }) {
  const router = useRouter();
  const [panel, setPanel] = useState<OpenPanel>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function open(next: OpenPanel) {
    setMessage(null);
    setPanel(panel === next ? null : next);
  }

  async function drinkOne(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Recording this bottle…");
    const form = new FormData(event.currentTarget);
    const rating = nullableText(form, "rating");
    const { error } = await createClient().rpc("drink_one", {
      p_wine_id: wineId,
      p_drank_at: new Date(String(form.get("drank_at"))).toISOString(),
      p_rating: rating ? Number(rating) : null,
      p_tasting_note: nullableText(form, "tasting_note"),
    });

    setBusy(false);
    if (error) {
      setMessage(error.message.includes("No bottles") ? "No bottles remain to drink." : "The bottle could not be recorded. Please try again.");
      return;
    }
    setPanel(null);
    setMessage("Bottle recorded in your wine diary.");
    router.refresh();
  }

  async function addBottles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Adding bottles…");
    const form = new FormData(event.currentTarget);
    const price = nullableText(form, "unit_price");
    const sourceType = String(form.get("transaction_type"));
    const { error } = await createClient().rpc("add_bottles", {
      p_wine_id: wineId,
      p_quantity: Number(form.get("quantity")),
      p_transaction_type: sourceType,
      p_occurred_at: new Date(String(form.get("occurred_at"))).toISOString(),
      p_unit_price_pence: price ? Math.round(Number(price) * 100) : null,
      p_source: nullableText(form, "source"),
      p_note: nullableText(form, "note"),
    });

    setBusy(false);
    if (error) {
      setMessage("The bottles could not be added. Please try again.");
      return;
    }
    setPanel(null);
    setMessage("Bottles added to your cellar.");
    router.refresh();
  }

  async function addPastTasting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Adding this wine memory…");
    const form = new FormData(event.currentTarget);
    const rating = nullableText(form, "rating");
    const date = nullableText(form, "drank_at");
    const { error } = await createClient().rpc("record_past_tasting", {
      p_wine_id: wineId,
      p_drank_at: date ? new Date(date).toISOString() : null,
      p_rating: rating ? Number(rating) : null,
      p_tasting_note: nullableText(form, "tasting_note"),
    });

    setBusy(false);
    if (error) {
      setMessage(error.message.includes("rating or tasting note")
        ? "Add a rating or tasting note first."
        : "The past tasting could not be recorded. Please try again.");
      return;
    }
    setPanel(null);
    setMessage("Past tasting added. Your bottle quantity has not changed.");
    router.refresh();
  }

  return (
    <section className="wine-actions-section" aria-label="Wine actions">
      <div className="wine-primary-actions">
        <button disabled={quantity < 1 || busy} onClick={() => open("drink")} type="button">
          Drink One
        </button>
        <button disabled={busy} onClick={() => open("add")} type="button">
          Add Bottles
        </button>
      </div>
      <button className="past-tasting-action" disabled={busy} onClick={() => open("past")} type="button">
        Add Past Tasting
      </button>

      {panel === "drink" ? (
        <form className="action-panel" onSubmit={drinkOne}>
          <div className="action-panel-heading">
            <div><p className="eyebrow">Wine diary</p><h2>Drink one bottle?</h2></div>
            <button aria-label="Close Drink One" onClick={() => setPanel(null)} type="button">×</button>
          </div>
          <p className="action-intro">This reduces the cellar quantity by one and permanently records the occasion.</p>
          <div className="action-field-grid">
            <label><span>Date</span><input defaultValue={today()} name="drank_at" required type="date" /></label>
            <label><span>Personal rating</span><select defaultValue="" name="rating"><option value="">No rating</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => <option key={rating} value={rating}>{rating}/10</option>)}</select></label>
            <label className="action-full-field"><span>Tasting note</span><textarea name="tasting_note" placeholder="Optional—what was memorable?" rows={4} /></label>
          </div>
          <button className="confirm-action" disabled={busy} type="submit">{busy ? "Recording…" : "Confirm Drink One"}</button>
        </form>
      ) : null}

      {panel === "add" ? (
        <form className="action-panel" onSubmit={addBottles}>
          <div className="action-panel-heading">
            <div><p className="eyebrow">Inventory</p><h2>Add bottles</h2></div>
            <button aria-label="Close Add Bottles" onClick={() => setPanel(null)} type="button">×</button>
          </div>
          <div className="action-field-grid">
            <label><span>Quantity</span><input defaultValue="1" inputMode="numeric" min="1" name="quantity" required type="number" /></label>
            <label><span>Date</span><input defaultValue={today()} name="occurred_at" required type="date" /></label>
            <label><span>How acquired</span><select defaultValue="purchased" name="transaction_type"><option value="purchased">Purchased</option><option value="gift">Gift</option><option value="other_acquisition">Other</option></select></label>
            <label><span>Price per bottle</span><span className="money-input"><b>£</b><input inputMode="decimal" min="0" name="unit_price" placeholder="Optional" step="0.01" type="number" /></span></label>
            <label className="action-full-field"><span>Source</span><input name="source" placeholder="Optional merchant, giver or source" /></label>
            <label className="action-full-field"><span>Note</span><textarea name="note" placeholder="Optional" rows={3} /></label>
          </div>
          <button className="confirm-action" disabled={busy} type="submit">{busy ? "Adding…" : "Add Bottles"}</button>
        </form>
      ) : null}

      {panel === "past" ? (
        <form className="action-panel" onSubmit={addPastTasting}>
          <div className="action-panel-heading">
            <div><p className="eyebrow">Wine memory</p><h2>Add a past tasting</h2></div>
            <button aria-label="Close Add Past Tasting" onClick={() => setPanel(null)} type="button">×</button>
          </div>
          <p className="action-intro">Record a previous experience without changing the number of bottles in your cellar.</p>
          <div className="action-field-grid">
            <label><span>Date, if remembered</span><input max={today()} name="drank_at" type="date" /></label>
            <label><span>Personal rating</span><select defaultValue="" name="rating"><option value="">No rating</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => <option key={rating} value={rating}>{rating}/10</option>)}</select></label>
            <label className="action-full-field"><span>Tasting note</span><textarea name="tasting_note" placeholder="Optional—what do you remember?" rows={4} /></label>
          </div>
          <button className="confirm-action" disabled={busy} type="submit">{busy ? "Adding…" : "Add Past Tasting"}</button>
        </form>
      ) : null}

      {message ? <p className="action-message" role="status">{message}</p> : null}
    </section>
  );
}

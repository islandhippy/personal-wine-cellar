import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type OpenAIResponse = {
  output?: { content?: { type?: string; text?: string }[] }[];
};

function responseText(response: OpenAIResponse) {
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  let question = "";
  try {
    const body = await request.json();
    question = typeof body.question === "string" ? body.question.trim() : "";
  } catch {
    return NextResponse.json({ error: "Please enter a question." }, { status: 400 });
  }
  if (!question || question.length > 500) {
    return NextResponse.json({ error: "Please enter a shorter question." }, { status: 400 });
  }

  const { data: wines, error } = await supabase
    .from("wines")
    .select("id, name, producer, vintage_year, bottle_size_ml, country, region, appellation, wine_type, current_quantity, drink_from_year, drink_until_year, cellar_notes, purchase_price_pence, shelves(name), wine_grape_varieties(grape_varieties(name)), drinking_events(rating, tasting_note, drank_at, date_known)")
    .eq("status", "active")
    .gt("current_quantity", 0)
    .order("drink_until_year", { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: "Your cellar could not be read just now." }, { status: 500 });
  if (!wines?.length) return NextResponse.json({ error: "There are no bottles in your cellar yet." }, { status: 400 });

  const cellar = wines.map((wine) => {
    const grapes = (wine.wine_grape_varieties ?? []).flatMap((entry) => {
      const value = entry.grape_varieties as { name?: string } | { name?: string }[] | null;
      return Array.isArray(value) ? value.map((item) => item.name).filter(Boolean) : value?.name ? [value.name] : [];
    });
    const shelf = Array.isArray(wine.shelves) ? wine.shelves[0]?.name : (wine.shelves as { name?: string } | null)?.name;
    const events = (wine.drinking_events ?? []).filter((event) => event.rating || event.tasting_note).slice(-5);
    return {
      id: wine.id,
      wine: wine.name,
      producer: wine.producer,
      vintage: wine.vintage_year ?? "NV",
      type: wine.wine_type,
      bottleMl: wine.bottle_size_ml,
      origin: [wine.country, wine.region, wine.appellation].filter(Boolean).join(", "),
      grapes,
      quantity: wine.current_quantity,
      shelf: shelf ?? "Shelf not set",
      drinkingWindow: wine.drink_from_year || wine.drink_until_year
        ? `${wine.drink_from_year ?? "?"}–${wine.drink_until_year ?? "?"}`
        : null,
      cellarNotes: wine.cellar_notes,
      previousExperiences: events,
    };
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "The wine assistant has not been connected yet." }, { status: 503 });

  const openAI = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.6-terra",
      reasoning: { effort: "low" },
      max_output_tokens: 1400,
      instructions: `You are Phil's private personal wine-cellar adviser. Recommend only from the supplied CURRENT CELLAR. Never invent a wine, fact, shelf, quantity, drinking window, rating or note. Do not recommend an item whose ID is absent from the cellar. Prefer no more than three recommendations. Consider food pairing, maturity, drinking windows, remaining quantity, and Phil's recorded preferences where relevant. An ended drinking window means consider soon, not undrinkable. If the cellar lacks information needed for certainty, state that briefly. Return only valid JSON with this exact shape: {"introduction":"brief answer","recommendations":[{"wineId":"exact supplied UUID","title":"Wine name · Producer, vintage","reason":"concise personalised reason","detail":"quantity, shelf, and drinking-window facts"}],"closing":"optional brief note"}. Do not use markdown.`,
      input: `CURRENT CELLAR:\n${JSON.stringify(cellar)}\n\nPHIL'S QUESTION:\n${question}`,
    }),
  });

  if (!openAI.ok) {
    const detail = await openAI.text();
    console.error("OpenAI response error", openAI.status, detail.slice(0, 500));
    return NextResponse.json({ error: "The assistant could not answer just now. Please try again." }, { status: 502 });
  }

  const raw = responseText(await openAI.json() as OpenAIResponse);
  try {
    const parsed = JSON.parse(raw) as { introduction?: unknown; recommendations?: unknown; closing?: unknown };
    if (typeof parsed.introduction !== "string" || !Array.isArray(parsed.recommendations)) throw new Error("Invalid shape");
    const allowedIds = new Set(wines.map((wine) => wine.id));
    const recommendations = parsed.recommendations
      .filter((item): item is { wineId: string; title: string; reason: string; detail: string } => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Record<string, unknown>;
        return typeof candidate.wineId === "string" && allowedIds.has(candidate.wineId)
          && typeof candidate.title === "string" && typeof candidate.reason === "string" && typeof candidate.detail === "string";
      })
      .slice(0, 3);
    if (!recommendations.length) throw new Error("No grounded recommendations");
    return NextResponse.json({
      introduction: parsed.introduction,
      recommendations,
      closing: typeof parsed.closing === "string" ? parsed.closing : undefined,
    });
  } catch {
    return NextResponse.json({ error: "The assistant’s answer was unclear. Please ask again." }, { status: 502 });
  }
}

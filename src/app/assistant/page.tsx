import type { Metadata } from "next";
import Link from "next/link";
import { WineAssistant } from "./wine-assistant";

export const metadata: Metadata = { title: "Wine Assistant" };

export default function AssistantPage() {
  return (
    <main className="cellar-shell assistant-shell">
      <header className="page-header">
        <Link className="back-link" href="/">‹ My Cellar</Link>
        <p className="eyebrow">From your own collection</p>
        <h1 className="page-title">What shall I drink?</h1>
        <p className="page-intro">
          Ask about a meal, an occasion or the sort of wine you fancy. Recommendations
          only consider bottles currently in your EuroCave.
        </p>
      </header>
      <WineAssistant />
    </main>
  );
}

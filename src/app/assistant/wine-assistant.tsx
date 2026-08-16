"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Recommendation = {
  wineId: string;
  title: string;
  reason: string;
  detail: string;
};

type AssistantAnswer = {
  introduction: string;
  recommendations: Recommendation[];
  closing?: string;
};

const suggestions = [
  "What should I drink with lamb tonight?",
  "Choose a bottle that is ready now",
  "I fancy something unusual",
];

export function WineAssistant() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setAnswer(null);
    setMessage("");

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The assistant could not answer just now.");
      setAnswer(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The assistant could not answer just now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="assistant-panel">
      <form onSubmit={ask}>
        <label htmlFor="assistant-question">Ask about your cellar</label>
        <textarea
          id="assistant-question"
          maxLength={500}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="For example: What should I drink with roast lamb tonight?"
          rows={4}
          value={question}
        />
        <button className="primary-action" disabled={loading || !question.trim()} type="submit">
          {loading ? "Considering your cellar…" : "Ask my wine assistant"}
        </button>
      </form>

      {!answer && !loading ? (
        <div className="assistant-suggestions" aria-label="Suggested questions">
          {suggestions.map((suggestion) => (
            <button key={suggestion} onClick={() => setQuestion(suggestion)} type="button">
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {message ? <p className="assistant-error" role="alert">{message}</p> : null}

      {answer ? (
        <div className="assistant-answer" aria-live="polite">
          <p>{answer.introduction}</p>
          <ol>
            {answer.recommendations.map((recommendation) => (
              <li key={recommendation.wineId}>
                <Link href={`/wines/${recommendation.wineId}`}>
                  <strong>{recommendation.title}</strong>
                  <span>{recommendation.reason}</span>
                  <small>{recommendation.detail}</small>
                  <b aria-hidden="true">View wine ›</b>
                </Link>
              </li>
            ))}
          </ol>
          {answer.closing ? <p className="assistant-closing">{answer.closing}</p> : null}
          <p className="assistant-caution">A personal suggestion, not a guarantee—your own taste comes first.</p>
        </div>
      ) : null}
    </section>
  );
}

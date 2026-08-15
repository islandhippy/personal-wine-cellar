import Link from "next/link";

export function FeaturePlaceholder({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="feature-shell">
      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> My Cellar
      </Link>
      <section className="feature-intro">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="feature-title">{title}</h1>
        <p>{children}</p>
        <div className="next-stage-note">This feature is next to be built.</div>
      </section>
    </main>
  );
}

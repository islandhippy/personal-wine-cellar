import Link from "next/link";

export default function Home() {
  return (
    <main className="shell">
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Personal Wine Cellar</p>
        <h1 id="page-title">My Cellar</h1>
        <p className="summary">
          The private home for your EuroCave collection and wine diary.
        </p>
        <div className="foundation-note">
          <p>Project foundation ready.</p>
          <span>Inventory features will be added in the next stages.</span>
        </div>
        <Link className="security-link" href="/security/passkeys">
          Face ID &amp; security
        </Link>
      </section>
    </main>
  );
}

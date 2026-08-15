import type { Metadata } from "next";
import { LoginPanel } from "./login-panel";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="eyebrow">Personal Wine Cellar</p>
        <h1 className="auth-title" id="login-title">
          My Cellar
        </h1>
        <p className="auth-intro">
          Your private EuroCave collection and personal wine diary.
        </p>
        <LoginPanel queryError={error} />
      </section>
    </main>
  );
}

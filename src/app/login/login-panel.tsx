"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LOGIN_ERRORS: Record<string, string> = {
  "invalid-link": "That recovery link has expired or has already been used.",
  "missing-code": "That recovery link is incomplete. Please request a new one.",
};

export function LoginPanel({ queryError }: { queryError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"passkey" | "recovery" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function signInWithPasskey() {
    setBusy("passkey");
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPasskey();

    if (error) {
      setMessage(
        error.message.includes("cancel")
          ? "Face ID sign-in was cancelled."
          : "Face ID sign-in was not completed. You can try again or use recovery.",
      );
      setBusy(null);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("recovery");
    setMessage(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/security/passkeys`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    });

    setBusy(null);
    setMessage(
      error
        ? "A recovery email could not be sent. Check the address and try again."
        : "If this is the cellar owner’s email, a secure recovery link is on its way.",
    );
  }

  return (
    <div className="login-actions">
      <button
        className="primary-action"
        disabled={busy !== null}
        onClick={signInWithPasskey}
        type="button"
      >
        {busy === "passkey" ? "Checking Face ID…" : "Continue with Face ID"}
      </button>

      <details className="recovery-panel">
        <summary>Sign-in help</summary>
        <p>
          Use the owner’s email only when setting up Face ID or recovering access
          on a new device.
        </p>
        <form onSubmit={requestRecovery}>
          <label htmlFor="recovery-email">Owner’s email</label>
          <input
            autoComplete="email"
            id="recovery-email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <button
            className="secondary-action"
            disabled={busy !== null}
            type="submit"
          >
            {busy === "recovery" ? "Sending…" : "Send recovery link"}
          </button>
        </form>
      </details>

      {(message || queryError) && (
        <p className="form-message" role="status">
          {message ?? LOGIN_ERRORS[queryError ?? ""] ?? "Sign-in was not completed."}
        </p>
      )}
    </div>
  );
}

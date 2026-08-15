"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Passkey = {
  created_at: string;
  friendly_name?: string;
  id: string;
};

export function PasskeyManager() {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshPasskeys() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.passkey.list();

    if (error) {
      setMessage("Face ID access is not available yet. Please try again later.");
    } else {
      setPasskeys(data ?? []);
    }
    setBusy(false);
  }

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    void supabase.auth.passkey.list().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setMessage("Face ID access is not available yet. Please try again later.");
      } else {
        setPasskeys(data ?? []);
      }
      setBusy(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function registerPasskey() {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.registerPasskey();

    if (error) {
      setMessage(
        error.message.includes("cancel")
          ? "Face ID setup was cancelled."
          : "Face ID setup was not completed. Please try again.",
      );
      setBusy(false);
      return;
    }

    setMessage("Face ID access is ready on this device.");
    await refreshPasskeys();
  }

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="passkey-manager">
      <div className="passkey-status">
        <span>Registered passkeys</span>
        <strong>{busy ? "Checking…" : passkeys.length}</strong>
      </div>

      {passkeys.length > 0 && (
        <ul className="passkey-list">
          {passkeys.map((passkey) => (
            <li key={passkey.id}>
              <strong>{passkey.friendly_name || "Apple passkey"}</strong>
              <span>
                Added {new Date(passkey.created_at).toLocaleDateString("en-GB")}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        className="primary-action"
        disabled={busy}
        onClick={registerPasskey}
        type="button"
      >
        {passkeys.length > 0 ? "Add another passkey" : "Set up Face ID"}
      </button>

      <button
        className="text-action"
        disabled={busy}
        onClick={signOut}
        type="button"
      >
        Sign out
      </button>

      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

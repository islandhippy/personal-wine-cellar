# Authentication and Face ID

My Cellar is a private, single-user application. It uses Supabase Auth for identity and an Apple passkey for routine Face ID sign-in.

## Normal sign-in

On an enrolled iPhone, the user selects **Continue with Face ID**. Safari asks iCloud Keychain for the app's passkey and the iPhone verifies the user with Face ID. Facial information stays on the device and is never sent to My Cellar, Vercel or Supabase.

The application keeps a secure session, so Face ID is normally required only after signing out, clearing browser data or moving to a new device.

## Initial enrolment

Supabase requires an existing confirmed user before a passkey can be registered. The one-time setup is:

1. Create the sole owner account in Supabase.
2. Open a secure email sign-in link.
3. Visit **Face ID & security**.
4. Select **Set up Face ID** and approve the iPhone passkey prompt.
5. Sign out once and confirm **Continue with Face ID** works.

## Recovery

The login page keeps **Sign-in help** behind a collapsed disclosure. It sends a magic link only to the existing owner account; it cannot create another account.

Recovery email remains necessary in case the iPhone, iCloud Keychain passkey or Apple account becomes unavailable. It is not intended for everyday sign-in.

## Production-domain requirement

Passkeys are tied to a WebAuthn relying-party domain. Production enrolment must wait until the permanent Vercel address is confirmed. Preview deployment domains must never be used as the relying-party ID.

The confirmed production origin and relying-party ID are:

- Origin: `https://personal-wine-cellar-six.vercel.app`
- Relying-party ID: `personal-wine-cellar-six.vercel.app`

Changing the relying-party ID makes existing passkeys unusable, so the production project name and domain should remain stable after enrolment.

## Supabase settings checklist

- Passkey authentication enabled.
- Relying-party ID set to the permanent production domain without `https://`.
- Relying-party origin set to the same domain with `https://`.
- Site URL set to the production application URL.
- Redirect allow-list includes the production `/auth/callback` route.
- Public account creation disabled after the sole owner account exists.
- Owner email confirmed.
- Publishable key stored in `.env.local` and in Vercel environment variables.
- Secret or service-role keys never exposed to the browser or committed to GitHub.

Supabase currently describes passkey support as experimental, so the passkey-specific code is isolated in the authentication layer and can be updated without changing cellar data or inventory workflows.

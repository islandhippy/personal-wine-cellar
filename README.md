# Personal Wine Cellar

A private, mobile-first personal wine cellar and wine diary. The application is designed for a single EuroCave fridge with six shelves.

Production address: `https://personal-wine-cellar-six.vercel.app`

## Current stage

This repository contains the Next.js Progressive Web App foundation, versioned database migrations and the application-side authentication flow. The live Supabase and Vercel services must be configured before sign-in can be used.

## Intended platform

- Next.js and TypeScript
- Vercel hosting
- Supabase authentication, PostgreSQL and private image storage
- Installable iPhone Progressive Web App

## Local setup

The detailed, non-technical setup guide will be expanded as external services are connected. Application secrets belong in `.env.local`, using `.env.example` as a guide. Never commit `.env.local` or service-role keys.

## Commands

```text
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
```

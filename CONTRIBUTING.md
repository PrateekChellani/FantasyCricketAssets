Contributing

Thanks for helping build Fantasy Cricket! This doc explains how we work and how to propose changes safely.

TL;DR

All work happens on branches → open a Pull Request (PR) into main.

We keep main protected; no direct pushes.

Add [preview] in any commit message to trigger a Vercel Preview build.

When merging to main, include [deploy] in the merge commit message to ship to Production.

Branching model

main: production-ready. Protected; merges only via PRs.

Short-lived branches off main, e.g.:

feat/<short-title>

fix/<short-title>

chore/<short-title>

No local CLI required. You can create/edit branches entirely in GitHub’s web UI.

Create a branch (GitHub UI)

Open the repo → Branch dropdown → New branch.

Name it (e.g., feat/sign-in-modal) → Create branch.

Environment & secrets

Do not commit secrets. Production secrets live in Vercel/Supabase dashboards.

Required env vars (already configured in Vercel):

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

If you add a new env var, document it in README.md and add it in Vercel (Project → Settings → Environment Variables).

Making changes (GitHub UI, no CLI)

Switch to your branch (feat/...).

Create/edit files with the pencil icon.

In the commit form:

Keep messages clear (see below).

Add [preview] to the message if you want a Vercel Preview deployment.

Repeat until ready for review.

Commit message style
feat: add SignInPopUp component [preview]
fix: correct OAuth callback redirect
chore: tidy layout imports


Use a concise verb (feat, fix, chore, etc.), then a short description.

Use [preview] when you want Vercel to build a preview for that commit/PR.

Pull Requests

Go to Pull requests → New pull request.

base: main | compare: your branch.

Write a clear title and description. If applicable, link issues (Closes #123).

Assign a reviewer (or @PrateekChellani).

Ensure checks pass (Preview build, type checks, etc.).

Keep PRs focused and small when possible.

PR checklist

 Code compiles; types pass.

 No secrets in code.

 Screenshots / preview link added if UI changes.

 Any new env var documented.

Requesting a Preview build

If the PR shows “No preview,” push another commit with [preview] in the message.

Merging

Prefer Squash and merge for a clean history.

In the merge commit message, add [deploy] if you want to deploy to production.

Examples

Safe merge without deploy:
feat: sign-in popup (squash)

Merge and deploy to Production:
feat: sign-in popup (squash) [deploy]

Production deployments are gated by commit messages to prevent accidental deploys.

Reverting a change

If a merge causes issues:

Open the merged PR → Revert → this creates a new PR.

Merge the revert PR (include [deploy] if you need an immediate production rollback).

Code style & structure

Next.js App Router (/app). Keep components in /app/components.

Client components use "use client"; at the top.

Prefer small, focused components.

TypeScript: keep props typed; avoid any.

Use environment-safe access for process.env.* (never in serverless edge code unless allowed).

UI/UX conventions (current)

Header shows Players, Matches, Guide, About with dropdowns.

Auth:

Header shows “Sign in” or current user name + “Sign out”.

SignInPopUp opens from header; closes on success or via the ❌ button only.

Definition of Done (DoD)

Feature implemented and reachable from UI.

No console errors.

Supabase rules/policies updated if required (and documented).

README/Guides updated if behavior changes.

PR merged; production deployed only if [deploy] was included.

Questions / Help

Open a Discussion or a Draft PR to get early feedback.
For deploy or environment access, ping the repo owner.

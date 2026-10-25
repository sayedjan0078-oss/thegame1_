# The Game — GitHub + Vercel deployment package

This package keeps the supplied site's original HTML/CSS/JavaScript intact and adds a separate synchronization layer plus Vercel API functions. The only addition inside `index.html` is one script include for `/sync.js`; no existing lines from the supplied HTML were removed or rewritten. `index.original.html` is the byte-for-byte original upload for comparison/reference.

## What syncs across devices

- Games added/edited in the existing admin panel (`customGames`)
- Deleted built-in game IDs (`deletedBaseIds`)
- Admin banner changes (`banners`)

Theme and favorites remain per-browser, since those are personal preferences. Changes are checked on other devices about every 15 seconds, and the page reloads when shared data changes so the original app can initialize from the latest state.

Shared data is stored as `.thegame-data/state.json` in the same GitHub repository using the GitHub Contents API. The GitHub token is used only by Vercel server functions and is never sent to the browser.

## Before deploying

**Important security note:** The original HTML itself contains the admin username/password (`admingame` / `gametheadmin`). They were deliberately left untouched to respect the request not to alter the existing code. This means the current front-end login credentials are visible to anyone who can inspect the public HTML. For a public production site, change the original login mechanism and credentials in a separately approved security update. Until then, do not treat the existing admin panel as confidential.

## 1. Create a GitHub repository

1. Create a new repository on GitHub, preferably private while testing.
2. Upload the *contents* of this folder to the repository root (not the enclosing folder).
3. Use `main` as the branch, or set `GITHUB_BRANCH` to your actual default branch.

## 2. Create a GitHub token

Create a fine-grained personal access token restricted to this repository with **Contents: Read and write** permission. Do not put the token in `index.html`, `sync.js`, or any public file. Add it only as a Vercel environment variable.

## 3. Import the repository into Vercel

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Under **Project Settings → Environment Variables**, add:
   - `GITHUB_TOKEN` — the fine-grained GitHub token
   - `GITHUB_OWNER` — your GitHub username or organization
   - `GITHUB_REPO` — the repository name only
   - `GITHUB_BRANCH` — normally `main`
   - `GITHUB_STATE_PATH` — `.thegame-data/state.json`
   - `ADMIN_USERNAME` — `admingame`
   - `ADMIN_PASSWORD` — `gametheadmin`
   - `SYNC_SECRET` — a long random secret, at least 32 characters
3. Add the variables to **Production**, **Preview**, and **Development** as needed.
4. Deploy. After changing environment variables, redeploy the project.

You can generate a random secret on your computer with:
- Windows PowerShell: `-join ((1..48) | ForEach-Object { [char](Get-Random -Minimum 33 -Maximum 127) })`

Do not share your GitHub token or the value of `SYNC_SECRET` in chat.

## 4. Test the deployment

1. Open the Vercel URL and log into the existing admin panel with the current credentials.
2. Add or edit a game or banner and save it.
3. Open the same site in a second browser/device. Within about 15 seconds, it should load the shared change.
4. If saving fails, open browser Developer Tools → Console and look for `[The Game Sync]` errors. Check Vercel → Project → Logs for API errors.

## Important limitations

- GitHub is being used as a lightweight shared JSON store, not a full database. It is suitable for a small showcase site with occasional admin updates, but simultaneous edits from multiple admins can conflict; save again if a conflict occurs.
- The API rejects shared-state payloads larger than 3 MB. If the existing app stores uploaded images as large embedded data URLs, use externally hosted image URLs or add a dedicated image-storage service in a future step.
- The first admin save creates the shared-state file. If the file does not exist yet, the site initially continues to use its built-in/default data.
- This ZIP prepares the project; it does not connect to your GitHub or Vercel accounts automatically. You must import it and set environment variables yourself.

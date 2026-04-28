# Selective Capital Portal

A small Express app with two purposes:

1. **Upload Portal** — `/upload/<rep>` — merchants upload bank statements, ID, and a voided check; documents are emailed (with attachments) to that rep.
2. **Funding Application** — `/apply/<rep>` — merchants fill out the application; submissions are converted into a Mahere Capital–branded email and sent to that rep.

Each rep has a personalized link based on their slug. The app never stores files long-term — uploads are held in memory just long enough to email them and are then discarded.

## Rep links (after deploy)

Replace `https://YOUR-APP.up.railway.app` with your actual Railway URL.

| Rep   | Email                    | Upload                                       | Apply                                       |
|-------|--------------------------|----------------------------------------------|---------------------------------------------|
| JS    | js@selectivecap.com      | `https://YOUR-APP.up.railway.app/upload/js`    | `https://YOUR-APP.up.railway.app/apply/js`    |
| Josh  | josh@selectivecap.com    | `.../upload/josh`                              | `.../apply/josh`                              |
| EJ    | ej@selectivecap.com      | `.../upload/ej`                                | `.../apply/ej`                                |
| Jenn  | jenn@selectivecap.com    | `.../upload/jenn`                              | `.../apply/jenn`                              |
| Ryan  | ryan@selectivecap.com    | `.../upload/ryan`                              | `.../apply/ryan`                              |

The home page (`/`) shows a clean admin index of all rep links so reps can grab their own.

To add or remove reps, edit `reps.js` and redeploy.

## Deploy to Railway

1. Push this folder to a GitHub repo.
2. In Railway, **New Project → Deploy from GitHub** → pick the repo.
3. Add environment variables (Settings → Variables) — see `.env.example`. The required ones are:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
   - `MAIL_FROM` (e.g. `"Selective Capital Portal <portal@selectivecap.com>"`)
   - `PUBLIC_BASE_URL` (the URL Railway assigns once deployed)
4. Railway runs `npm install` then `node server.js` automatically — no Procfile changes needed.

### Alternative: deploy with Railway CLI
```
npm install -g @railway/cli
railway login
railway init
railway up
```

## SMTP setup options

Pick whichever email path you want to use; they all work with the generic SMTP envs.

**Google Workspace (selectivecap.com on Gmail)**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=portal@selectivecap.com
SMTP_PASS=<App Password from your Google account>
```
Create an App Password at: https://myaccount.google.com/apppasswords (2FA must be on first).

**SendGrid** (recommended for production — better deliverability when sending docs)
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=<your SendGrid API key>
```

**Resend**
```
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=<your Resend API key>
```

> Set `MAIL_BCC=ops@selectivecap.com` (optional) to silently copy every submission to a central inbox for audit/backup.

## Local development

```
cp .env.example .env
# fill in SMTP creds (or leave blank — submissions will fail but pages render)
npm install
npm start
# → http://localhost:3000
```

## What the rep receives

**Upload submission email** has the merchant's contact info, a list of attached docs grouped by type (bank statements, driver's license, voided check, other), and the actual files attached. Reply-To is set to the merchant's email so the rep can reply directly.

**Application submission email** is a Mahere Capital–branded HTML email containing the full application formatted as a clean lead sheet. Two attachments are included: a standalone HTML copy of the Mahere application, and a JSON file with the structured data (handy if you later want to import into a CRM).

## Security notes

- All file handling is in-memory; nothing is written to disk.
- File-type allowlist (PDF, common image formats, Word docs).
- 15 MB per-file limit, max 20 files per upload (configurable via `MAX_FILE_MB`).
- Per-IP rate limit of 10 submissions / 15 min on the API endpoints.
- HTTPS is provided automatically by Railway.
- SSN is collected over HTTPS but is NOT logged. If you'd rather not collect SSN on the web form, delete the `ownerSsn` field from `public/apply.html` and `mahereTemplate.js`.

## Customizing branding

- **Selective Capital (front-end pages):** edit the `--sc-*` CSS variables in `public/styles.css`. Drop a real logo image into `public/` and replace the `.brand-mark` block in `upload.html` / `apply.html`.
- **Mahere Capital (rep email):** edit `mahereTemplate.js`. The colors `#0f1e44` and `#1d4ed8` come from the Mahere Capital logo.

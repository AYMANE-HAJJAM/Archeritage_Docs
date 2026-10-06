# Office previews on the existing Render service

Production is a **Native Node Web Service**, as reported by the service owner.
The repository's `render.yaml` is an optional Docker example, not evidence that
production runs Docker. Neither it nor `Dockerfile` is used by a dashboard-managed
Native service merely because these files are committed.

## Root cause and confirmation boundary

`lib/documents/converter.ts` executes LibreOffice (`soffice`) for Office-to-PDF
conversion. There is no npm equivalent installed by this application. It searches
`SOFFICE_PATH`, standard installation paths and PATH. Missing LibreOffice produces
`libreoffice_missing` and the preview route returns HTTP 422 on a cache miss.
Setting `SOFFICE_PATH` cannot install the dependency.

Render's [Native runtime documentation](https://render.com/docs/native-runtimes)
lists its preinstalled tools, including ffmpeg, but not LibreOffice. This repo has
no Native build/start installer for LibreOffice. Even the previous optional
Dockerfile installed only ffmpeg.

These facts confirm the deployment dependency gap. They do not constitute a
live inspection of the production container: no Render shell, dashboard settings
or production logs were available in this workspace. For direct confirmation,
run the following in the **existing service's Render Shell**, once the diagnostic
file is available there (it accesses no database or remote storage):

```sh
node scripts/check-office-runtime.mjs
```

Without that file, run `command -v soffice || command -v libreoffice`, followed by
`soffice --headless --version` if found. A preview response containing
`code: "libreoffice_missing"` also confirms the application's detection result.
Do not use `diagnose-docx-preview.ts` or `inspect-one-docx.ts` for this check:
those existing tools access production records and stored originals.

## Can Native Node provide LibreOffice?

Native Node can execute an installed Linux executable, but Render does not
document a supported apt/system-package installation configuration for Native
services. Its [Docker guidance](https://render.com/docs/docker#docker-or-native-runtime)
specifically recommends Docker for required OS packages missing from Native
runtimes. A build-time rootless extraction of downloaded packages is technically
possible, but would require maintaining LibreOffice's transitive shared libraries,
fonts, loader paths, security updates, and build-to-runtime persistence. It is
not a reliable minimal fix to claim or ship without verifying the actual runtime.
Simply adding `apt-get install libreoffice` to a Native build command is not the
supported solution recommended here.

To retain this application's **local LibreOffice pipeline** using Render's
supported OS-package installation mechanism, change the **existing service's
runtime** to Docker. This changes its packaging, not its application or storage
architecture. Keeping Native would instead require a maintained portable bundle
or a separate conversion service, both larger changes than extending the existing
Dockerfile. No such new service or Native installer was added.

## Minimal prepared fix (not deployed)

- `Dockerfile`: install `libreoffice-writer`, `libreoffice-impress`, and
  `libreoffice-calc`, with DejaVu/Liberation fonts, in the final runtime image.
  Keep ffmpeg. Set `SOFFICE_PATH=/usr/bin/soffice`. Run a version and writable-temp
  check as the unprivileged production user during image build. Use the already
  configured Next.js standalone server and give that user a writable `.cache`
  directory for the existing disk caches. No database migrations or seeds run.
- `render.yaml`: clarify that it is an optional Docker Blueprint and add the
  Linux `SOFFICE_PATH`. Do not create a second service or sync this example over
  the existing dashboard-managed service.
- `lib/documents/converter.ts`: use a correctly escaped file URL for isolated
  LibreOffice profiles; retry transient cleanup failures and log failed cleanup.
- `scripts/check-office-runtime.mjs`: dependency and scratch-space diagnostic,
  usable in either Native or Docker without accessing uploaded files or services.
- `tests/storage/document-converter.test.ts`, `tests/fixtures/README.md`, and
  synthetic `tests/fixtures/office/sample.pptx` / `sample.xlsx`: test Word,
  PowerPoint, Excel and cleanup after successful and failed real conversions.

## Exact future Render configuration change

Only after approval to deploy:

1. Commit the prepared changes to the connected repository/branch.
2. In the **existing service**, Settings → Build → Source → Edit, keep its current
   repository and branch, and select Docker. Use `./Dockerfile`, context `.` and
   the image's default command (`node server.js`); clear any custom Docker command
   override. Render's [runtime-change instructions](https://render.com/docs/native-runtimes#changing-a-services-runtime)
   explain that saving via Deploy starts a deployment. Do not do this in advance.
3. Preserve every existing environment variable, secret, domain, plan, disk mount
   and health-check setting. If `SOFFICE_PATH` is currently set to a local/Windows
   path, change it to `/usr/bin/soffice` (dashboard variables override image defaults).
   Keep `FFMPEG_PATH` valid for Linux if configured; `/usr/bin/ffmpeg` exists.
   Render's `PORT` is used by the standalone server, bound to `0.0.0.0`.
4. Do not add a migration, seed, cache invalidation, upload, or storage operation.

A normal git push alone **will not fix the existing Native service**: its runtime
must change once in the dashboard (or via the API). Later pushes can build the
Docker image normally if Git auto-deploy is enabled. Merely editing `render.yaml`
does not change a dashboard-managed service. A Blueprint-managed service instead
requires updating and syncing its existing Blueprint, with its settings preserved.

## Preview and temporary-file behavior

The authenticated `/api/files/[id]/preview` route streams original PDFs directly.
For DOCX/PPTX/XLSX (all supported), it checks disk/private preview caches, reads
original bytes on a cache miss, converts to PDF, and serves that derivative.
The existing derived-cache behavior remains unchanged; no cache was read,
cleared or regenerated against remote storage during this work.

Images use the existing content/thumbnail route. Videos use original browser
playback or the existing ffmpeg MP4 conversion route. Neither uses LibreOffice,
and their application paths are unchanged. Spreadsheet preview is paginated PDF,
not an interactive workbook. Font substitutions may affect Office pagination.

Each Office conversion uses `fs.mkdtemp` under `os.tmpdir()` (normally `/tmp` on
Render), with separate input, output and LibreOffice-profile directories, and a
180-second subprocess timeout. No persistent disk is required for scratch files.
`finally` removes that entire per-conversion directory on success or failure,
retrying transient filesystem errors and reporting cleanup failures. A forced
process/container termination cannot execute JavaScript cleanup; Render's
ephemeral filesystem is discarded when an instance is replaced.

The `.cache/previews` directory contains deliberately retained PDF **cache**
derivatives, not conversion scratch files; it has no automatic TTL in the current
implementation. This change does not alter its retention or existing B2 caches.

## Validation

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
Office integration tests require LibreOffice with Writer/Impress/Calc; they skip
when the executable is absent. They use only checked-in synthetic/local fixtures
and assert valid PDF output plus removal of scratch inputs, PDFs and profiles.
Existing video tests exercise real ffmpeg conversion when available.

Before the future deployment, validate the Linux image on a machine with a
running Docker engine: `docker build -t archeritage-docs .`. The final stage's
diagnostic checks LibreOffice and scratch writes/cleanup as `nextjs`. Local Windows
conversion tests cannot establish Linux/Render runtime behavior or production
authenticated preview behavior; those still need post-deploy verification.

Workspace validation on 2026-10-06: typecheck, lint and production build passed;
99 tests completed with 97 passed and two expected skips for missing-binary
branches because LibreOffice/ffmpeg were installed. DOCX/PPTX/XLSX real conversion,
success/failure cleanup, and MP4/AVI/MTS conversion tests passed. The runtime
diagnostic passed locally. Commands used a localhost `DATABASE_URL` override;
no production database or storage operation was run. Linux image validation was
unavailable because the local Docker engine was not running. Render runtime
verification remains pending; no deployment was performed.

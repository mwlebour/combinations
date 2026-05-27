# Implementation Plan: Deployment & CI/CD Setup

This plan details the setup to build and deploy the "Elemental Combinations" game to production under your custom domain `lebourgeo.is`.

---

## Proposed Infrastructure Architecture

### 1. URL Routing: `combinations.lebourgeo.is` (Recommended)
We recommend using **`combinations.lebourgeo.is`** rather than a subdirectory:
* **Isolation**: Deploying to a separate GCS bucket guarantees that building/deploying this app will never overwrite or interfere with your main website `lebourgeo.is` files.
* **Simplicity**: Cloudflare can route the subdomain directly to a GCS bucket backend. A subdirectory would require complex Cloudflare Workers or routing rules to split traffic from the same bucket.
* **Caching**: You can apply custom Cloudflare caching rules specifically for the game without affecting your main site's cache settings.

### 2. GCP Project Configuration
* **Project Selection**: Use the **same GCP project** where you host `lebourgeo.is`.
* **GCS Bucket Naming Rule**: Google Cloud Storage requires that to serve a bucket via a CNAME record, **the bucket name must exactly match the domain name**.
  * We will create a bucket named: `combinations.lebourgeo.is`
  * We will set the bucket's website configuration:
    * Index document: `index.html`
    * Error (404) document: `index.html` (to support frontend router fallbacks)
  * We will grant public read permissions (`allUsers` -> `Storage Object Viewer`) to this bucket.

### 3. Cloudflare Integration
* **DNS CNAME Record**: Create a CNAME record for `combinations` pointing to the Google Cloud Storage API endpoint: `c.storage.googleapis.com`.
* **Proxy Status**: **Enabled (Orange Cloud)**. This is crucial because Google Storage doesn't serve custom SSL certificates on HTTP website endpoints. Cloudflare will serve the SSL certificate to your users and fetch from GCS in the backend.
* **SSL/TLS Mode**: Set to **Full** (Cloudflare terminates SSL and communicates with GCS over HTTP/HTTPS).

---

## User Review Required

> [!IMPORTANT]
> To configure the GitHub Actions workflow, you will need to add a Google Cloud Service Account key to your GitHub repository secrets.
> 1. We will need to create a Service Account in your GCP console (e.g. `github-actions-deployer`).
> 2. We will grant this Service Account `Storage Object Admin` permissions on the new `combinations.lebourgeo.is` bucket.
> 3. You will save the JSON key file of this service account as a secret named `GCP_SA_KEY` in your GitHub repository.

---

## Open Questions

> [!WARNING]
> * **GCP Service Account**: Do you already have a service account JSON key that has access to write to your GCP buckets, or would you like instructions on how to create a restricted one for this bucket?
> * **GitHub Repo Name**: Is this code housed in a standalone repository, or is it a subfolder/branch in your main `lebourgeo.is` repo? (The CI/CD pipeline will be committed to the root of the active repo).

---

## Proposed Changes

### Component: Package Scripts

#### [MODIFY] [package.json](file:///Users/mwl/mwl/combinations/package.json)
* Add a `build` script to compile the production-ready static web files:
  ```json
  "build": "expo export --platform web"
  ```
  *(This compiles all React Native code, custom SVGs, and state logic into a high-performance, optimized static site in the `dist/` directory).*

---

### Component: CI/CD Pipeline

#### [NEW] [deploy.yml](file:///Users/mwl/mwl/combinations/.github/workflows/deploy.yml)
* GitHub Actions workflow triggered on merges to the `main` branch:
  1. Checks out the repository.
  2. Sets up Node.js.
  3. Installs dependencies using `npm ci`.
  4. Compiles the web bundle: `npm run build`.
  5. Authenticates with Google Cloud using `GCP_SA_KEY`.
  6. Deploys to GCS: Runs `gsutil rsync` to upload the `dist/` folder contents.
  7. Sets cache headers (long-term caching for static assets, no-cache for `index.html` to prevent serving stale versions).

---

## Verification Plan

### Automated Checks
* Verify compiling the production bundle locally:
  ```bash
  npm run build
  ```
* Verify TypeScript validation:
  ```bash
  npx tsc --noEmit
  ```

### Manual Verification
* Deploy manually once to the bucket using your local shell (if gcloud CLI is configured) to verify bucket access.
* Perform DNS lookup verification on `combinations.lebourgeo.is` to ensure Cloudflare CNAME propagates.

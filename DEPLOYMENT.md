# Backend deployment (Google Cloud Run)

## Prerequisites

- Google Cloud project with Cloud Run and Cloud SQL (PostgreSQL) enabled
- A GCS bucket for uploads and PDFs (optional; if not set, local disk is used)
- `gcloud` CLI installed and authenticated (for one-time setup)

---

## Option A: Continuous deploy from GitHub (recommended)

Push to your repo and Cloud Build builds and deploys the backend automatically.

### 1. One-time setup

1. **Create resources** (see “Create resources” below): Cloud SQL, GCS bucket, Secret Manager secrets.
2. **Create the Cloud Run service once** (so env vars and Cloud SQL are attached):
   - In Cloud Run, create a new service.
   - Choose **“Continuously deploy from a repository (source or function)”** → **GitHub**.
   - Connect your GitHub account and select the **backend repo** (this repository; it contains only the backend and `cloudbuild.yaml`).
   - **Branch**: e.g. `main`.
   - **Build configuration**: **Cloud Build** (not “Dockerfile only”).
   - **Cloud Build configuration file**: set to **`/cloudbuild.yaml`** (path from repo root). This repo contains only the backend, so `cloudbuild.yaml` builds the current directory (`.`) and deploys to Cloud Run.
   - **Region**: e.g. `us-central1`. To use another region, edit the `_REGION` substitution in `cloudbuild.yaml` or set it in the build trigger.
   - Complete the wizard; the first build will run.
3. **Configure the new service** (env and secrets):
   - Open the new Cloud Run service → **Edit & deploy new revision**.
   - Under **Variables & secrets**, add env vars (e.g. `NODE_ENV=production`, `GCS_BUCKET`, `ADMIN_ORIGIN`) and reference Secret Manager secrets for `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
   - Under **Connections**, add your **Cloud SQL** instance.
   - Deploy the revision.

After that, every push to the selected branch will trigger a build using **`cloudbuild.yaml`** at the repo root, which builds the image and deploys it.

### 2. What the build does

**`cloudbuild.yaml`** (at the repo root):

- Builds the Docker image with context `.` (repo root = this backend).
- Pushes the image to Container Registry.
- Deploys the new image to the Cloud Run service `school-admission-backend`.

To change the region or service name, edit the `substitutions` in **`cloudbuild.yaml`** (e.g. `_REGION`, `_SERVICE_NAME`), or override them in the Cloud Build trigger.

---

## Option B: Deploy from container image (manual build)

Use this if you prefer to build and push the image yourself (or from another CI) and then deploy.

## 1. Create resources

- **Cloud SQL**: Create a PostgreSQL instance and database. Note the connection name (`project:region:instance`).
- **GCS bucket**: Create a bucket (e.g. `your-project-school-admission-files`) for uploads and PDFs.
- **Secret Manager**: Create secrets for `JWT_SECRET`, `OPENAI_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (and optionally Firebase credentials).

## 2. Build and push image

From the `backend/` directory:

```bash
# Set your GCP project and image name
export PROJECT_ID=your-gcp-project
export IMAGE=gcr.io/$PROJECT_ID/school-admission-backend

# Build with Cloud Build (uses Dockerfile in this directory)
gcloud builds submit --tag $IMAGE
```

Or build locally and push:

```bash
docker build -t $IMAGE .
docker push $IMAGE
```

## 3. Deploy to Cloud Run

Connect the service to Cloud SQL using the Cloud SQL Auth Proxy or a VPC connector. Example with Unix socket (run Cloud SQL Proxy as sidecar or use same VPC):

```bash
# DATABASE_URL for Cloud SQL with Unix socket (when using proxy):
# postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE

gcloud run deploy school-admission-backend \
  --image $IMAGE \
  --platform managed \
  --region YOUR_REGION \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,PORT=8080,GCS_BUCKET=your-bucket-name,ADMIN_ORIGIN=https://admin.yourdomain.com" \
  --set-secrets "JWT_SECRET=JWT_SECRET:latest,DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest" \
  --add-cloudsql-instances PROJECT:REGION:INSTANCE
```

Adjust `--set-env-vars` and `--set-secrets` to match your Secret Manager secret names. For Firebase, add `GOOGLE_APPLICATION_CREDENTIALS` or rely on the service account.

## 4. Migrations

Migrations run automatically on container start (`prisma migrate deploy` in the Dockerfile). To run them separately (e.g. from Cloud Build), run:

```bash
npx prisma migrate deploy
```

with `DATABASE_URL` set (e.g. via Cloud SQL Proxy).

## 5. Environment variables

| Variable | Description |
|---------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Cloud SQL format when using proxy) |
| `JWT_SECRET` | Secret for JWT signing |
| `PORT` | Set to `8080` by Cloud Run (default in Dockerfile) |
| `GCS_BUCKET` | GCS bucket name for uploads and PDFs (omit for local disk) |
| `ADMIN_ORIGIN` | Admin site origin for CORS (e.g. `https://admin.yourdomain.com`) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay API keys |
| `OPENAI_API_KEY` | OpenAI API key for AI assistant |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON (optional) |

See `.env.example` for a full list.

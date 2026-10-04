# Phase 4 — S3 deploy runbook

Status: ready, blocked on `APP_URL` (needs the Vercel project URL). The stack code lives in `packages/infra`; this note covers only the residual manual steps that code cannot own.

Target: account `576884309830`, region `us-east-1`, via the `noted` AWS profile. The profile's own region default differs, so every command below pins `us-east-1` explicitly — do not rely on the default.

## Deploy the stack (agent)

Prereq: the Vercel production URL.

```powershell
$env:AWS_PROFILE='noted'; $env:AWS_REGION='us-east-1'; $env:APP_URL='https://<vercel-prod-url>'
pnpm --filter @noted/infra run deploy
```

(`run` avoids pnpm's builtin `deploy`.) Record the three stack outputs: `BucketName`, `BucketEndpoint`, `WriterUserName`. If `APP_URL` ever changes, re-run deploy with the new value — CORS updates in place, no data impact.

## Mint the writer access key (owner, one-time)

Why manual: CloudFormation cannot export access-key secret material (only the key ID), so the secret is created out-of-band and injected via env.

Console: IAM → Users → `<WriterUserName>` → Security credentials → Create access key → use case "Application running outside AWS". Or CLI:

```powershell
aws iam create-access-key --user-name <WriterUserName> --profile noted --region us-east-1
```

The secret is shown once — save it immediately. It never enters the repo.

## Vercel env (owner, one-time)

Production environment only (Preview deploys pointing at the prod bucket would mix test uploads with real data):

| Variable               | Value source                  |
| ---------------------- | ----------------------------- |
| `S3_BUCKET`            | `BucketName` stack output     |
| `S3_ENDPOINT`          | `BucketEndpoint` stack output |
| `S3_REGION`            | `us-east-1`                   |
| `S3_ACCESS_KEY_ID`     | minted key ID                 |
| `S3_SECRET_ACCESS_KEY` | minted secret                 |

## Verify (no secrets printed)

1. `aws s3api head-bucket --bucket <BucketName> --profile noted --region us-east-1` — bucket exists and is reachable (uses your SSO session, not the app key).
2. On the deployed app: upload a photo note, confirm it renders; remove it, confirm the book archive. This exercises presigned PUT, GET, and delete through the writer key.
3. Negative check: the writer key cannot list buckets or touch anything outside this bucket (policy is bucket-scoped; `CreateBucket` withheld, so a missing bucket fails loudly instead of being recreated ad hoc).

## Rotation (no code change)

Create a second key → update the two Vercel vars → verify an upload → delete the old key. The app reads creds from env at process start; Vercel redeploys on env change.

## Recovery and cost

- Leaked key: deactivate/delete it in IAM immediately (uploads fail closed), then rotate per above.
- Stack deletion keeps the bucket (`Retain`): to remove all data, empty the bucket first, then delete it manually.
- Cost: standard S3 storage + requests + egress in `us-east-1`; near zero until launch traffic.

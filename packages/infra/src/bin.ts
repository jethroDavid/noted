import "server-only";
import { App } from "aws-cdk-lib";
import { MediaBucketStack } from "./media-bucket";

const app = new App();
const appUrl =
  (app.node.tryGetContext("appUrl") as string | undefined) ??
  process.env.APP_URL;
if (!appUrl) {
  throw new Error(
    "MediaBucketStack needs the production origin: pass -c appUrl=https://<prod> or set APP_URL.",
  );
}

// Unresolved account/region keeps the stack environment-agnostic so
// `cdk synth` runs without AWS credentials; deploy resolves them.
new MediaBucketStack(app, "NotedMedia", {
  appUrl,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION,
  },
});

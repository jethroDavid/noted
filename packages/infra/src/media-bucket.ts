import "server-only";
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import { Effect, PolicyStatement, User } from "aws-cdk-lib/aws-iam";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
} from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export interface MediaBucketStackProps extends StackProps {
  // Exact production origin (e.g. https://noted.vercel.app). S3 CORS
  // origins are exact-match only — no wildcard subdomains.
  appUrl: string;
}

// Production media bucket for presigned browser uploads plus server-side
// processing (see packages/media). Private, SSL-only, retained: user
// data must survive stack updates, so removal is a deliberate manual act.
export class MediaBucketStack extends Stack {
  constructor(scope: Construct, id: string, props: MediaBucketStackProps) {
    super(scope, id, props);

    const bucket = new Bucket(this, "Media", {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [HttpMethods.GET, HttpMethods.PUT],
          allowedOrigins: [props.appUrl],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        { abortIncompleteMultipartUploadAfter: Duration.days(7) },
      ],
    });

    // Server identity for the Vercel deployment. Object actions mirror
    // exactly what packages/media calls: presigned Get/Put, confirm-time
    // HeadObject (s3:GetObject), and DeleteObjects cleanup. ListBucket
    // lets ensureBucket's HeadBucket succeed; CreateBucket is withheld
    // on purpose — the bucket is CDK-owned, so a missing bucket must
    // fail loudly instead of being recreated without this config.
    const writer = new User(this, "MediaWriter");
    writer.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [bucket.arnForObjects("*")],
      }),
    );
    writer.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["s3:ListBucket"],
        resources: [bucket.bucketArn],
      }),
    );

    // Access keys are created manually (console or CLI) and injected via
    // Vercel env vars — key material never lives in this repo.
    new CfnOutput(this, "BucketName", {
      value: bucket.bucketName,
      description: "S3_BUCKET for the production env",
    });
    new CfnOutput(this, "BucketEndpoint", {
      value: `https://s3.${this.region}.amazonaws.com`,
      description: "S3_ENDPOINT for the production env",
    });
    new CfnOutput(this, "WriterUserName", {
      value: writer.userName,
      description: "IAM user to mint an access key for",
    });
  }
}

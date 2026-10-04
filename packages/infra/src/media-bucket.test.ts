import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { MediaBucketStack } from "./media-bucket";

const APP_URL = "https://noted.example.com";

function template() {
  const app = new App();
  const stack = new MediaBucketStack(app, "NotedMedia", {
    appUrl: APP_URL,
  });
  return Template.fromStack(stack);
}

describe("MediaBucketStack", () => {
  // Synthesized once: the first synthesis pays the CDK cold start (~6s).
  const t = template();

  it("keeps the bucket private, encrypted, SSL-only, and retained", () => {
    t.hasResourceProperties("AWS::S3::Bucket", {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
        ],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    t.hasResource("AWS::S3::Bucket", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
    t.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "s3:*",
            Condition: { Bool: { "aws:SecureTransport": "false" } },
          }),
        ]),
      },
    });
  });

  it("opens CORS only to the production origin for GET and PUT", () => {
    template().hasResourceProperties("AWS::S3::Bucket", {
      CorsConfiguration: {
        CorsRules: [
          {
            AllowedMethods: ["GET", "PUT"],
            AllowedOrigins: [APP_URL],
            AllowedHeaders: ["*"],
            MaxAge: 3000,
          },
        ],
      },
    });
  });

  it("aborts incomplete multipart uploads", () => {
    template().hasResourceProperties("AWS::S3::Bucket", {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
            Status: "Enabled",
          }),
        ]),
      },
    });
  });

  it("grants the writer exactly the media actions on this bucket", () => {
    t.resourceCountIs("AWS::IAM::User", 1);
    t.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: [
          {
            Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
            Effect: "Allow",
            Resource: { "Fn::Join": Match.anyValue() },
          },
          {
            Action: "s3:ListBucket",
            Effect: "Allow",
            Resource: { "Fn::GetAtt": Match.anyValue() },
          },
        ],
      },
    });
  });

  it("outputs the bucket name, endpoint, and writer username", () => {
    t.hasOutput("BucketName", {});
    t.hasOutput("BucketEndpoint", {});
    t.hasOutput("WriterUserName", {});
  });
});

import { describe, expect, it } from "vitest";
import { migrationConnectionString } from "./migrate";

describe("deployment migration connection", () => {
  it("uses Neon's corresponding direct endpoint while preserving credentials, database, and options", () => {
    const pooled =
      "postgresql://app:p%40ss@ep-example-pooler.us-east-1.aws.neon.tech/noted?sslmode=require&channel_binding=require";
    const result = new URL(migrationConnectionString({ DATABASE_URL: pooled }));
    expect(result.hostname).toBe("ep-example.us-east-1.aws.neon.tech");
    expect(result.username).toBe("app");
    expect(result.password).toBe("p%40ss");
    expect(result.pathname).toBe("/noted");
    expect(result.searchParams.get("sslmode")).toBe("require");
    expect(result.searchParams.get("channel_binding")).toBe("require");
  });

  it("uses separately configured migration credentials when present", () => {
    const direct =
      "postgresql://migrator:secret@ep-example.us-east-1.aws.neon.tech/noted?sslmode=require";
    expect(
      migrationConnectionString({
        DATABASE_URL: "postgresql://app@localhost/noted",
        MIGRATION_DATABASE_URL: direct,
      }),
    ).toBe(direct);
  });

  it("does not rewrite other providers' hostnames or local test databases", () => {
    const url = "postgresql://app:secret@some-pooler.example.com:5433/noted";
    expect(migrationConnectionString({ DATABASE_URL: url })).toBe(url);
    expect(
      migrationConnectionString({
        DATABASE_URL: "postgresql://noted@localhost:5434/noted",
      }),
    ).toBe("postgresql://noted@localhost:5434/noted");
  });

  it("fails closed without a valid PostgreSQL URL and never echoes the supplied credential", () => {
    expect(() => migrationConnectionString({})).toThrow("required");
    expect(() =>
      migrationConnectionString({
        DATABASE_URL: "https://user:private@example.com",
      }),
    ).toThrow("PostgreSQL connection");
    expect(() =>
      migrationConnectionString({
        DATABASE_URL: "not a url with private data",
      }),
    ).toThrow("URL is invalid");
  });
});

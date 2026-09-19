import { ServiceError } from "@noted/server";
import { ZodError, type ZodType } from "zod";

export async function readBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ServiceError(400, "Send a valid JSON body.");
  }
  return schema.parse(value);
}

export async function apiRoute(action: () => Promise<unknown>, status = 200) {
  const headers = { "Cache-Control": "no-store" };
  try {
    return Response.json(await action(), {
      status,
      headers,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers },
      );
    }
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Check the form fields and try again." },
        { status: 400, headers },
      );
    }
    console.error("API request failed", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500, headers },
    );
  }
}

import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function error(status: number, message: string, code?: string, details?: unknown) {
  return NextResponse.json(
    { error: message, code: code ?? httpCode(status), details },
    { status }
  );
}

function httpCode(status: number): string {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthorized";
    case 402:
      return "payment_required";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "unprocessable";
    case 429:
      return "rate_limited";
    default:
      return "error";
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) {
    return error(err.status, err.message, err.code, err.details);
  }
  console.error("[unhandled]", err);
  return error(500, "Error interno", "internal_error");
}

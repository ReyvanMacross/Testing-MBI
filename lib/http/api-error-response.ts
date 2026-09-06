import { NextResponse } from "next/server";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function apiErrorResponse(
  error: unknown,
  context: string,
  fallbackMessage = "Permintaan tidak dapat diproses.",
) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error(context, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

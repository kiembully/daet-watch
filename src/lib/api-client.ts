"use client";

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : {};

  if (!response.ok) {
    const error = (body as { error?: ApiErrorPayload }).error;
    throw new ApiClientError(response.status, {
      code: error?.code ?? "request_failed",
      message: error?.message ?? `Request failed (${response.status})`,
      details: error?.details,
    });
  }
  return body as T;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { accept: "application/json", ...(init?.headers ?? {}) },
    cache: init?.cache ?? "no-store",
  });
  return parse<T>(response);
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(response);
}

export interface ItemEnvelope<T> {
  item: T;
}
export interface ListEnvelope<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

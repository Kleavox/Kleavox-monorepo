export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function readApiResponse<T = unknown>(
  response: Response,
): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new ApiError(
      payload.message || "The request could not be completed.",
      response.status,
      payload.code,
    );
  }
  return payload as T;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  return readApiResponse<T>(response);
}

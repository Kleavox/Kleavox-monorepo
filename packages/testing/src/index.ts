export function jsonRequest(
  url: string,
  body: unknown,
  init: RequestInit = {},
): Request {
  return new Request(url, {
    ...init,
    method: init.method ?? "POST",
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
    body: JSON.stringify(body),
  });
}

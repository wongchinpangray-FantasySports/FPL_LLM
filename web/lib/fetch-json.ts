/** Parse JSON from a fetch response without throwing on HTML error pages. */
export async function readJsonResponse<T>(
  res: Response,
): Promise<T | null> {
  const raw = await res.text();
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function apiErrorMessage(
  res: Response,
  data: { error?: string } | null,
  fallback: string,
): string {
  if (data?.error) return data.error;
  if (res.status === 401) return "Sign in to use this feature.";
  if (res.status === 404) {
    return "This endpoint is unavailable — refresh the page or try again later.";
  }
  if (res.status >= 500) {
    return `${fallback} (server error ${res.status}).`;
  }
  if (!data) {
    return `${fallback} (unexpected response ${res.status}).`;
  }
  return fallback;
}

/** Coerce API / network errors into a string safe for Alert.alert (Android requires string). */
export function formatApiError(err: unknown, fallback = 'Something went wrong'): string {
  const e = err as {
    message?: unknown;
    code?: string;
    request?: unknown;
    response?: { status?: number; data?: unknown };
  };

  const data = e?.response?.data;

  if (typeof data === 'string' && data.trim()) return data.trim();

  const raw =
    (data && typeof data === 'object' && 'error' in data
      ? (data as { error?: unknown }).error
      : undefined) ??
    (data && typeof data === 'object' && 'message' in data
      ? (data as { message?: unknown }).message
      : undefined) ??
    e?.message;

  if (typeof raw === 'string' && raw.trim()) return raw.trim();

  if (raw && typeof raw === 'object') {
    const nested = raw as { message?: unknown; error?: unknown };
    if (typeof nested.message === 'string' && nested.message.trim()) return nested.message.trim();
    if (typeof nested.error === 'string' && nested.error.trim()) return nested.error.trim();
  }

  if (
    e?.code === 'ECONNREFUSED' ||
    e?.code === 'ERR_NETWORK' ||
    e?.message === 'Network Error'
  ) {
    return 'Cannot connect to server. Please check your internet connection.';
  }

  if (e?.request && !e?.response) {
    return 'Cannot connect to server. Please check your internet connection.';
  }

  return fallback;
}

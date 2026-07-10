import axios from 'axios';

/**
 * Extract a human-readable message from an error of unknown type.
 * Prefers the server's `{ error: { message } }` or `{ message }` payload,
 * then the axios/network message, then the provided fallback.
 */
export const getApiErrorMessage = (
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; error?: { message?: string } }
      | undefined;
    return data?.error?.message || data?.message || err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  // Non-Error rejections that still carry a message (e.g. Stripe errors)
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
};

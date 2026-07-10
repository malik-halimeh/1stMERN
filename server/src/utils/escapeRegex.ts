/**
 * Escape user input for safe use inside a MongoDB $regex so characters
 * like "." or "*" match literally instead of acting as regex operators.
 */
export const escapeRegex = (input: string): string =>
  input.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

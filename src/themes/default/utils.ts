// src/themes/default/utils.ts
export function escapeHtml(unsafe: unknown): string {
  if (typeof unsafe === 'string') {
    return unsafe
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, '"')
      .replace(/'/g, "'");
  }
  if (unsafe === null || unsafe === undefined) {
      return '';
  }
  // If it's not a string but is some other type (like a number), convert it to a string and then escape.
  return String(unsafe)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, '"')
      .replace(/'/g, "'");
}
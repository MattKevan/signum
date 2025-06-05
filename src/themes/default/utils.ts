// src/themes/default/utils.ts
export function escapeHtml(unsafe: any): string {
  if (typeof unsafe !== 'string') {
    if (unsafe === null || unsafe === undefined) return '';
    unsafe = String(unsafe);
  }
  return unsafe
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'");
}
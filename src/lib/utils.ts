// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-'); // Replace multiple - with single -
}

export function generateSiteId(title: string): string {
  const randomString = Math.random().toString(36).substring(2, 7);
  return `${slugify(title)}-${randomString}`;
}

// isValidName was in fileTreeUtils.ts, can be kept there or moved here if generally useful.
// For this example, assuming it's in fileTreeUtils.ts and imported from there.
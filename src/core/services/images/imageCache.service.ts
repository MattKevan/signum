// A simple in-memory cache for generated derivatives.
// Key: "path/to/image.jpg_w400_h300_cover"
// Value: "data:image/jpeg;base64,..."
const derivativeCache = new Map<string, string>();

export function getCachedDerivative(key: string): string | undefined {
  return derivativeCache.get(key);
}

export function setCachedDerivative(key: string, dataUrl: string) {
  derivativeCache.set(key, dataUrl);
}
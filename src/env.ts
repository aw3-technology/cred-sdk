/**
 * Runtime detection. Nothing here runs at import time, so the SDK loads on
 * servers (Node 18+, Deno, Bun, edge) where there is no `window`.
 */

/**
 * A browser `location`, or undefined on a server. Deno exposes a `location`
 * getter that throws when no `--location` was given, hence the try/catch.
 */
const pageLocation = (): { href?: string; origin?: string } | undefined => {
  try {
    if (typeof document === "undefined") return undefined;
    const loc = (globalThis as { location?: { href?: string; origin?: string } }).location;
    return loc && typeof loc.href === "string" ? loc : undefined;
  } catch {
    return undefined;
  }
};

/** The current page URL in a browser, or undefined on a server. */
export const browserLocation = (): string | undefined => pageLocation()?.href;

/** The current page origin in a browser, or undefined on a server. */
export const browserOrigin = (): string | undefined => {
  const origin = pageLocation()?.origin;
  return origin && origin !== "null" ? origin : undefined;
};

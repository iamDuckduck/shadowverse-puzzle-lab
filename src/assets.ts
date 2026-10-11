declare global {
  interface Window {
    __WB_ASSETS?: Record<string, string>;
  }
}
/** A downloaded standalone preview supplies embedded original assets. */
export function asset(path: string): string {
  return window.__WB_ASSETS?.[path] ?? path;
}

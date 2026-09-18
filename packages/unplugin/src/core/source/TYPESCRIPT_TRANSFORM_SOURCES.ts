/**
 * The complete TypeScript source-extension contract shared by every adapter.
 *
 * Keep the loader beside the extension so filters, Bun's parser selection,
 * Turbopack registration, and project discovery cannot drift independently.
 */
export const TYPESCRIPT_TRANSFORM_SOURCES = [
  { extension: ".ts", bunLoader: "ts" },
  { extension: ".tsx", bunLoader: "tsx" },
  { extension: ".mts", bunLoader: "ts" },
  { extension: ".cts", bunLoader: "ts" },
] as const;

/**
 * The complete TypeScript source-extension contract shared by every adapter.
 *
 * Keep the loader beside the extension so filters, Bun's parser selection,
 * Turbopack registration, and project discovery cannot drift independently.
 */
const TYPESCRIPT_TRANSFORM_SOURCES = [
  { extension: ".ts", bunLoader: "ts" },
  { extension: ".tsx", bunLoader: "tsx" },
  { extension: ".mts", bunLoader: "ts" },
  { extension: ".cts", bunLoader: "ts" },
] as const;

/** Every source extension accepted by the ttsc transform. */
export const TYPESCRIPT_TRANSFORM_EXTENSIONS: readonly string[] =
  TYPESCRIPT_TRANSFORM_SOURCES.map(({ extension }) => extension);

/** The exact automatic and documented Turbopack rule set. */
export const TYPESCRIPT_TURBOPACK_RULE_GLOBS: readonly string[] =
  TYPESCRIPT_TRANSFORM_SOURCES.map(({ extension }) => `*${extension}`);

const extensionAlternation =
  TYPESCRIPT_TRANSFORM_EXTENSIONS.map(escapeRegExp).join("|");

/** Matches exactly the TypeScript source extensions the transform accepts. */
export const typescriptTransformSourcePattern = new RegExp(
  `(?:${extensionAlternation})$`,
);

/** Bun's registration filter, additionally excluding virtual NUL ids. */
export const bunTypeScriptTransformSourcePattern = new RegExp(
  `^[^\\x00]*(?:${extensionAlternation})$`,
);

/** Select Bun's parser for an exact TypeScript transform source. */
export function typescriptTransformBunLoader(
  filePath: string,
): "ts" | "tsx" | undefined {
  return TYPESCRIPT_TRANSFORM_SOURCES.find(({ extension }) =>
    filePath.endsWith(extension),
  )?.bunLoader;
}

/** Escape a literal extension for a generated regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

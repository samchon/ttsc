import { typescriptTransformSourcePattern } from "./source/typescriptTransformSourcePattern";

/**
 * Matches the exact TypeScript source extensions the ttsc transform handles:
 * `.ts`, `.tsx`, `.mts`, and `.cts`. JavaScript and invented extension forms
 * such as `.mtsx` are deliberately excluded.
 *
 * Shared with the Bun adapter (`bun.ts`) and the standalone Turbopack loader
 * (`turbopack.ts`) through {@link isTransformTarget}, so the filter is defined
 * once and every adapter answers the same way.
 */
export const sourceFilePattern = typescriptTransformSourcePattern;

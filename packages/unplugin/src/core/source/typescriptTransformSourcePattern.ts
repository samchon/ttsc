import { extensionAlternation } from "./extensionAlternation";

/** Matches exactly the TypeScript source extensions the transform accepts. */
export const typescriptTransformSourcePattern = new RegExp(
  `(?:${extensionAlternation})$`,
);

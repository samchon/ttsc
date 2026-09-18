import { extensionAlternation } from "./extensionAlternation";

/** Bun's registration filter, additionally excluding virtual NUL ids. */
export const bunTypeScriptTransformSourcePattern = new RegExp(
  `^[^\\x00]*(?:${extensionAlternation})$`,
);

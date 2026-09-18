import { TYPESCRIPT_TRANSFORM_EXTENSIONS } from "./TYPESCRIPT_TRANSFORM_EXTENSIONS";
import { escapeRegExp } from "./escapeRegExp";

/**
 * The regular-expression alternation of every accepted TypeScript source
 * extension, each one escaped.
 *
 * Built once from {@link TYPESCRIPT_TRANSFORM_EXTENSIONS} so that the plain
 * transform filter and Bun's NUL-excluding filter can never disagree about
 * which extensions reach the transform.
 */
export const extensionAlternation =
  TYPESCRIPT_TRANSFORM_EXTENSIONS.map(escapeRegExp).join("|");

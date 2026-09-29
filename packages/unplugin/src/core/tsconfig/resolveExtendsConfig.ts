import { resolveTsconfigExtends } from "ttsc/tsconfig";

/**
 * Resolve an `extends` specifier to the config file it names, or `null` when it
 * names none.
 *
 * The rule is ttsc's, `resolveTsconfigExtends`, written to TypeScript-Go's
 * `getExtendsConfigPath`: separators folded, a file-path specifier kept under
 * the spelling it was reached by, as TypeScript anchors a relatively extended
 * config (samchon/ttsc#1455), and a module specifier resolved to its physical
 * path. This reader only adds its policy: it is best-effort, so a specifier
 * that names nothing, or a preset whose manifest does not parse, answers
 * `null`, and the compiler reports the configuration error itself
 * (samchon/ttsc#1489).
 *
 * @param tsconfig The declaring config, as this reader named it.
 * @param specifier The `extends` value as written.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The host resolver owns TypeScript-Go file and package extends semantics;
 *   this reader maps absence and resolver errors to an unproven null result.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A small adapter adds best-effort policy without duplicating Node package
 *   resolution or TypeScript's lexical-anchor grammar.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The host resolver owns native file and Node package lookup, preserving
 *   compiler config separators and lexical file anchors across native platforms.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Null does not authorize compilation with an invented preset; the real
 *   compiler still reads the original config and reports invalid extends.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains lexical versus package anchors and why best-effort absence
 *   remains distinct from a compiler diagnostic.
 */
export function resolveExtendsConfig(
  tsconfig: string,
  specifier: string,
): string | null {
  try {
    return resolveTsconfigExtends(tsconfig, specifier);
  } catch {
    return null;
  }
}

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

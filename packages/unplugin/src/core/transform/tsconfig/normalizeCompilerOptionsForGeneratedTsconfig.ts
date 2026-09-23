import path from "node:path";
import { isRelativePluginSpecifier } from "ttsc/tsconfig";

import { CONFIG_DIR_TEMPLATE_LIST_OPTIONS } from "../../tsconfig/CONFIG_DIR_TEMPLATE_LIST_OPTIONS";
import { CONFIG_DIR_TEMPLATE_SCALAR_OPTIONS } from "../../tsconfig/CONFIG_DIR_TEMPLATE_SCALAR_OPTIONS";
import { absolutizePathsTarget } from "../../tsconfig/absolutizePathsTarget";
import { resolveConfigDirTemplatePath } from "../../tsconfig/resolveConfigDirTemplatePath";
import { readPaths } from "../alias/readPaths";

/**
 * Resolve all relative paths inside `compilerOptions` against `tsconfigDir`.
 *
 * The generated tsconfig lives in a temporary directory outside the project, so
 * any relative path (e.g. `"outDir": "../dist"`) that was meaningful relative
 * to the original tsconfig must be converted to an absolute path before writing
 * the generated file. Otherwise TypeScript-Go resolves it against the temp
 * dir.
 *
 * `paths` targets are absolutized for the same reason, with the extra twist
 * that TypeScript-Go rejects bare non-relative targets outright (TS5090) and
 * has removed `baseUrl` (TS5102), so anchoring them as absolute paths is the
 * only temp-dir-safe encoding. No synthetic `baseUrl` is ever written.
 *
 * @param spell The spelling every absolute path takes in the generated file:
 *   the compiler's, which spells the project physically, where the adapter's
 *   own reading spelled it as named (samchon/ttsc#1456). Identity by default.
 */
export function normalizeCompilerOptionsForGeneratedTsconfig(
  compilerOptions: Record<string, unknown>,
  tsconfigDir: string,
  spell: (file: string) => string = (file) => file,
): Record<string, unknown> {
  const output = { ...compilerOptions };
  // Scalar path fields: resolve each against the original tsconfig directory.
  for (const key of CONFIG_DIR_TEMPLATE_SCALAR_OPTIONS) {
    if (typeof output[key] === "string") {
      output[key] = spell(
        resolveConfigDirTemplatePath(tsconfigDir, output[key]),
      );
    }
  }
  // Array path fields: resolve each element individually.
  for (const key of CONFIG_DIR_TEMPLATE_LIST_OPTIONS) {
    if (Array.isArray(output[key])) {
      output[key] = output[key].map((entry) =>
        typeof entry === "string"
          ? spell(resolveConfigDirTemplatePath(tsconfigDir, entry))
          : entry,
      );
    }
  }
  const paths = readPaths(output.paths);
  if (Object.keys(paths).length !== 0) {
    output.paths = Object.fromEntries(
      Object.entries(paths).map(([key, targets]) => [
        key,
        targets.map((target) =>
          spell(absolutizePathsTarget(tsconfigDir, target)).replace(/\\/g, "/"),
        ),
      ]),
    );
  }
  if (Array.isArray(output.plugins)) {
    output.plugins = output.plugins.map((entry) =>
      normalizePluginConfigForGeneratedTsconfig(entry, tsconfigDir, spell),
    );
  }
  return output;
}

/**
 * Absolutize the relative path-typed keys of one plugin entry before it is
 * written into the generated temp-dir tsconfig: `config`/`source`/`transform`
 * are the descriptor-resolution keys, and `configFile` is the config-file
 * override accepted by the shipped utility plugins (`@ttsc/banner`,
 * `@ttsc/strip`, `@ttsc/lint`). Left relative, each would resolve against the
 * temp directory instead of the project.
 */
function normalizePluginConfigForGeneratedTsconfig(
  entry: unknown,
  tsconfigDir: string,
  spell: (file: string) => string,
): unknown {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return entry;
  }
  const output: Record<string, unknown> = { ...entry };
  for (const key of ["config", "configFile", "source", "transform"]) {
    const value = output[key];
    if (typeof value === "string" && isRelativePluginSpecifier(value)) {
      output[key] = spell(path.resolve(tsconfigDir, value));
    } else if (typeof value === "string" && path.isAbsolute(value)) {
      output[key] = spell(value);
    }
  }
  return output;
}

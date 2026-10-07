import path from "node:path";
import { isRelativePluginSpecifier } from "ttsc/tsconfig";

import { CONFIG_DIR_TEMPLATE_LIST_OPTIONS } from "../../tsconfig/CONFIG_DIR_TEMPLATE_LIST_OPTIONS";
import { CONFIG_DIR_TEMPLATE_SCALAR_OPTIONS } from "../../tsconfig/CONFIG_DIR_TEMPLATE_SCALAR_OPTIONS";
import { absolutizePathsTarget } from "../../tsconfig/absolutizePathsTarget";
import { resolveConfigDirTemplatePath } from "../../tsconfig/resolveConfigDirTemplatePath";
import { readPaths } from "../alias/readPaths";

/**
 * Reanchor recognized compiler and plugin path fields against `tsconfigDir`.
 *
 * The generated tsconfig lives in a temporary directory outside the project, so
 * a supported relative path (e.g. `"outDir": "../dist"`) that was meaningful
 * relative to the original tsconfig must be converted to an absolute path
 * before writing the generated file. Otherwise TypeScript-Go resolves it
 * against the temp dir.
 *
 * `paths` targets are absolutized for the same reason, with the extra twist
 * that TypeScript-Go rejects bare non-relative targets outright (TS5090) and
 * has removed `baseUrl` (TS5102), so anchoring them as absolute paths is the
 * only temp-dir-safe encoding. No synthetic `baseUrl` is ever written.
 *
 * @param spell Translation of recognized absolute path fields to the selected
 *   compiler spelling, which can be best-effort lexical fallback. Arbitrary
 *   payload fields are not translated. Identity by default
 *   (samchon/ttsc#1456).
 * @evidence contracts/common.md#principled-implementation Known compiler path options, paths targets and plugin descriptor/config-file addresses are anchored to the original config directory before the compiler reads a scratch wrapper; unrecognized payload fields are preserved.
 * @evidence contracts/common.md#clear-and-simple-design A shallow overlay copy separates scalar, list, alias and plugin path boundaries, with existing template and path-specifier helpers owning their grammars.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No unsupported baseUrl or arbitrary plugin-field rewriting compensates for a moved wrapper; only documented path-typed keys are reanchored.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain scratch-relative drift and TypeScript-Go paths constraints, while the private helper documents the plugin keys whose addresses legitimately require normalization.
 * @evidence contracts/portability.md#os-neutral-implementation Shared config-directory and relative-plugin helpers and Node path interpret supported native forms at the supplied anchor. The supplied spell callback translates recognized addresses without certifying physical lookup; forward slashes encode compiler path-target protocol values.
 * @evidence contracts/performance.md#efficient-algorithms
 *   The shallow copy scans K option keys; fixed path-key lists still map L list
 *   entries, A alias keys/T targets and P plugin entries with four recognized
 *   plugin fields. String/path resolution, target filtering and each supplied
 *   spell callback add their own costs; output keeps unrelated payload references.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   One current overlay projection coordinates no cross-request result. Equal
 *   path text alone does not permit suppressing a supplied effectful spell
 *   callback; generation reading/materialization owners establish broader reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
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

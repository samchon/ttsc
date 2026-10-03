import { COMPILER_OPTIONS } from "../../flags/COMPILER_OPTIONS";
import { normalizeCompilerEnumValue } from "../../flags/normalizeCompilerEnumValue";
import { readCompilerOptionValues } from "../../flags/readCompilerOptionValues";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import { CompilerArgumentsInspection } from "./CompilerArgumentsInspection";
import { outputText } from "./outputText";
import { resolveTsgo } from "./resolveTsgo";
import { spawnNative } from "./spawnNative";

/**
 * A reader of the compiler options a build will actually use: the project's
 * config with the flags forwarded on the command line applied over it, in the
 * order the compiler applies them.
 *
 * Several decisions ttsc makes about a build depend on an option the user can
 * override from the command line: whether the runtime build lowers `target:
 * ESNext` or a preserved `jsx`, and which `rootDir` the compiler mirrors
 * outputs against. Reading the config alone answers for a build that is not the
 * one that runs.
 *
 * A forwarded `@file` response file is expanded by the compiler itself through
 * `--showConfig`, which owns its quoting, nesting, and ordering; replaying only
 * the visible flags would miss the options inside it. Path values are returned
 * as written: a config path is already absolute, a forwarded one is relative to
 * the build's working directory, and a response-file one to the config's
 * directory.
 *
 * A separate observed safety tokenizer checks response frames before reporting
 * flags are appended; the native compiler still owns expansion and value
 * validation. Inspection uses the caller-provided child environment when supplied.
 *
 * Native shown properties remain authoritative, including paths and enums.
 * Reporting booleans omitted from showConfig retain their observed ordered
 * response assignments or configured boolean; an explicit null is still present.
 * Other omissions remain undefined rather than reviving a configured value.
 *
 * Visible arguments share one native-frame projection. Enum discriminants
 * follow their origin: CLI values are trimmed before lookup, while config
 * values retain whitespace. A present reset wins over the configured value.
 *
 * @returns The reader, or `null` when safe response inspection is unavailable
 *   or the compiler rejects the arguments. The caller forwards the original
 *   request untouched and retains the compiler diagnostic. Binary resolution,
 *   capture/read and malformed JSON failures can still throw; null is not a
 *   universal failure conversion. Safety observation does not pin response-file
 *   state across the later native inspection or actual build.
 * @evidence contracts/common.md#principled-implementation Actual response-file frames are validated by native showConfig, whose present properties remain authoritative; omitted booleans use observed shared-frame assignments before configured booleans without reviving present null resets; one native-frame projection applies visible assignments in order over resolved config values, including bare booleans and explicit resets, while config enums are lowercased without trimming or arbitrary schema validation.
 * @evidence contracts/common.md#clear-and-simple-design One returned reader exposes effective values to rootDir, runtime-profile and display consumers. Shared observed tokenization owns safe inspection admission, while native showConfig remains authoritative for response expansion and option values.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unavailable safety inspection or rejected response arguments yield null instead of fabricated effective values; shared generated occurrence metadata determines option arity and boolean assignment, while the separate conservative response tokenizer does not replace native validation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain precedence, response-file ownership, path bases and the null outcome before acknowledgment tags following documentation guidance.
 * @evidence contracts/performance.md#efficient-algorithms Visible arguments are projected once; response mode additionally observes/decodes/hashes expanded response bytes and reprojects them before one showConfig child. Complete capture/JSON parsing, delegated binary selection and native launch costs remain part of this operation. Each query performs option-name/alias normalization and lookups; config enum normalization adds value-text costs.
 * @evidence contracts/performance.md#reuse-equivalent-work One invocation shares the argument projection or compiler-expanded result across option queries; a new build invocation creates a reader because config and response-file state may change.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources The returned closure retains the compiler-options reference, assignment Map and optional shown record until its caller discards it; they are not a deep snapshot of mutable configuration. The invocation owns no historical reader cache. Response inspection and spawnNative own synchronous observation/capture cleanup attempts; child duration and expanded/captured bytes have no ceiling supplied here.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Executable and argument arrays are passed through the supported native runner; path values preserve compiler-selected bases instead of shell interpolation or an OS-specific rewrite.
 */
export function readEffectiveCompilerOptions(
  project: ITtscParsedProjectConfig,
  passthrough: readonly string[] = [],
  binary?: string,
  env?: NodeJS.ProcessEnv,
): ((name: string, aliases?: readonly string[]) => unknown) | null {
  const projected = readCompilerOptionValues(passthrough);
  let assignments = projected.values;
  let shown: Record<string, unknown> | undefined;
  if (projected.responseFiles.length !== 0) {
    try {
      const inspected = CompilerArgumentsInspection.inspect(
        ["-p", project.path, ...passthrough],
        project.root,
      );
      assignments = readCompilerOptionValues(inspected.args).values;
    } catch {
      return null;
    }
    const tsgo = resolveTsgo({ cwd: project.root, binary });
    const result = spawnNative(
      tsgo.binary,
      ["-p", project.path, ...passthrough, "--showConfig"],
      { cwd: project.root, env, encoding: "utf8" },
    );
    if (result.status !== 0) return null;
    shown = JSON.parse(outputText(result.stdout)).compilerOptions as Record<
      string,
      unknown
    >;
  }
  const compilerOptions = project.compilerOptions as Record<string, unknown>;
  return (name, aliases = []) => {
    const spec =
      COMPILER_OPTIONS.get(name.toLowerCase()) ??
      aliases
        .map((alias) => COMPILER_OPTIONS.get(alias.toLowerCase()))
        .find((candidate) => candidate !== undefined);
    const canonical = spec?.name ?? name;
    if (shown !== undefined) {
      if (Object.prototype.hasOwnProperty.call(shown, canonical))
        return shown[canonical];
      // showConfig omits reporting booleans even when explicitly enabled.
      // Paths and enums stay native-owned; omission must not revive a reset.
      if (spec?.kind !== "boolean") return undefined;
      if (assignments.has(canonical)) return assignments.get(canonical);
      const configured = compilerOptions[canonical];
      return typeof configured === "boolean" ? configured : undefined;
    }
    if (assignments.has(canonical)) return assignments.get(canonical);
    const configured = compilerOptions[canonical];
    return spec?.kind === "enum" && typeof configured === "string"
      ? normalizeCompilerEnumValue(configured, "json")
      : configured;
  };
}

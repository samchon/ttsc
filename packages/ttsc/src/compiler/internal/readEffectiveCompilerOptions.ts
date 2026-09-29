import { normalizeFlagToken } from "../../flags/normalizeFlagToken";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
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
 * @returns The reader, or `null` when the compiler rejects the forwarded
 *   arguments, so the caller forwards them untouched and the compiler reports
 *   its own diagnostic.
 *
 * @evidence contracts/common.md#principled-implementation Response files are expanded by the actual compiler showConfig contract; visible flags are replayed in order over resolved config values, including bare booleans and null clearing, without claiming arbitrary flag-schema validation.
 * @evidence contracts/common.md#clear-and-simple-design One returned reader exposes effective values to rootDir and runtime-profile consumers; response-file syntax stays with the compiler rather than a second quoting parser.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid forwarded response arguments yield null instead of a fabricated effective config; the noLib special case follows its supported bare-flag interpretation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain precedence, response-file ownership, path bases and the null outcome before acknowledgment tags following documentation guidance.
 * @evidence contracts/performance.md#efficient-algorithms Response-file mode launches showConfig once and subsequent reads use record lookup; visible-argument reads scan A tokens per option. No shared option index is built for the small consumer query population.
 * @evidence contracts/performance.md#reuse-equivalent-work One response-file reader shares the compiler-expanded result across option queries; a new build invocation creates a new reader because config and response-file state may change.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned closure transfers to its caller and retains only this invocation's options/arguments; spawnNative owns the completed process capture, with no historical cache here.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Executable and argument arrays are passed through the supported native runner; path values preserve compiler-selected bases instead of shell interpolation or an OS-specific rewrite.
 */
export function readEffectiveCompilerOptions(
  project: ITtscParsedProjectConfig,
  passthrough: readonly string[] = [],
  binary?: string,
): ((name: string, aliases?: readonly string[]) => unknown) | null {
  if (passthrough.some((token) => token.startsWith("@"))) {
    const tsgo = resolveTsgo({ cwd: project.root, binary });
    const result = spawnNative(
      tsgo.binary,
      ["-p", project.path, ...passthrough, "--showConfig"],
      { cwd: project.root, encoding: "utf8" },
    );
    if (result.status !== 0) return null;
    const shown = JSON.parse(outputText(result.stdout))
      .compilerOptions as Record<string, unknown>;
    return (name) => shown[name];
  }
  const compilerOptions = project.compilerOptions as Record<string, unknown>;
  return (name, aliases = []) => {
    let value = compilerOptions[name];
    for (let i = 0; i < passthrough.length; i++) {
      const token = passthrough[i]!;
      if (!token.startsWith("-")) continue;
      const normalized = normalizeFlagToken(token);
      if (normalized !== name.toLowerCase() && !aliases.includes(normalized)) {
        continue;
      }
      const next = passthrough[i + 1];
      // A boolean flag given bare (`--inlineSourceMap`, last or before another
      // flag) is on; the compiler reads it the same way.
      if (next === undefined || next.startsWith("-")) {
        value = true;
        continue;
      }
      value =
        name === "noLib" &&
        next !== "true" &&
        next !== "false" &&
        next !== "null"
          ? true
          : next === "null"
            ? undefined
            : next;
    }
    return value;
  };
}

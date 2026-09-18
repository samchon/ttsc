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

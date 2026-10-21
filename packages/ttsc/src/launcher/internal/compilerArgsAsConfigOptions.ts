import path from "node:path";

import { normalizeCompilerEnumValue } from "../../flags/normalizeCompilerEnumValue";
import { readCompilerOptionOccurrence } from "../../flags/readCompilerOptionOccurrence";

/**
 * Translate compiler command-line arguments into the `compilerOptions` of a
 * tsconfig that extends the project, so that a build which opens that tsconfig
 * alone sees the options the arguments would have given it.
 *
 * TypeScript applies command-line options over the options of the config it
 * builds, and an extending config's own `compilerOptions` override the config
 * it extends in the same way. So the assignments of `args`, written into the
 * extending config, win over the project exactly as they would on the command
 * line. Each value is converted the way the compiler parses it from argv: the
 * last occurrence of an option wins; `null` resets an inherited value; enum
 * values are trimmed and lowercased; a list value is split at commas and loses
 * its empty members; and a value that names a path is resolved against `cwd`,
 * because the compiler resolves a command-line path against its working
 * directory while a config path resolves against the config's directory.
 *
 * Arguments that a config cannot carry make the translation unavailable, so the
 * caller keeps a build that passes them on the command line: a response file, a
 * positional file name, an unknown option, an option the compiler accepts only
 * on the command line, a project selection, the trace and profile options whose
 * artifacts the compiler writes itself, and a value containing `${configDir}`,
 * which a config would substitute and the command line does not. The
 * translation assumes valid arguments; the caller confirms them with the same
 * compiler's own command-line parser before using the result.
 *
 * @param args Compiler arguments without the leading `-p <tsconfig>`.
 * @param cwd The directory the compiler would run in.
 * @returns The assignments by canonical option name, or `undefined` when the
 *   arguments cannot be carried by a config.
 * @evidence contracts/common.md#principled-implementation Each occurrence is classified by the pinned native grammar (readCompilerOptionOccurrence) and its value converted by the native command-line rules: null resets, last occurrence wins, enum trim and lowercase, list TrimSpace and comma split with empty members dropped, and paths resolved against the working directory. Command-line options override the configured ones as an extending config's options override its base, so writing them into the extending config preserves precedence. Premise: the arguments are valid; the caller verifies that with the consumer compiler's parseCommandLine. Options newer than the pinned table are unknown here and make the translation unavailable.
 * @evidence contracts/common.md#clear-and-simple-design One pure function owns the argv-to-config translation; the build that consumes it owns compiler selection, validation and emission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported argument classes return undefined so the caller keeps the command-line build instead of approximating them; no option is special-cased by consumer or fixture.
 * @evidence contracts/common.md#meaningful-documentation The prose states the precedence premise, every conversion rule, each class that makes the translation unavailable and the validity premise.
 * @evidence contracts/portability.md#os-neutral-implementation Path values are resolved with node:path against the supplied working directory, so drive letters and separators follow the host; no other value is touched as a path.
 * @evidence contracts/performance.md#efficient-algorithms One pass over the arguments with a constant-time table lookup per option and a split per list value.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The translation depends only on its arguments and is computed once per build.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned record is the only allocation and transfers to the caller.
 */
export function compilerArgsAsConfigOptions(
  args: readonly string[],
  cwd: string,
): Record<string, unknown> | undefined {
  const options: Record<string, unknown> = {};
  for (let index = 0; index < args.length; ) {
    if (args[index]!.startsWith("@")) return undefined;
    const occurrence = readCompilerOptionOccurrence(args, index);
    const option = occurrence.option;
    if (
      option === undefined ||
      option.commandLineOnly ||
      COMMAND_LINE_OUTPUTS.has(option.name)
    )
      return undefined;
    const next = occurrence.width === 2 ? args[index + 1]! : undefined;
    let value: unknown;
    if (next === "null") value = null;
    else if (option.configOnly) {
      // The command line accepts only `null`, or `false` for a boolean.
      if (option.kind !== "boolean" || next !== "false") return undefined;
      value = false;
    } else if (option.kind === "boolean") value = occurrence.booleanValue;
    else if (next === undefined)
      // A list whose value is empty; any other kind is an invalid argument.
      value = [];
    else if (next.includes("${configDir}")) return undefined;
    else if (option.kind === "number") value = Number(next);
    else if (option.kind === "enum")
      value = normalizeCompilerEnumValue(next, "cli");
    else if (option.kind === "list")
      value = splitList(next, option.element === "enum", option.filePath, cwd);
    else value = option.filePath ? path.resolve(cwd, next) : next;
    options[option.name] = value;
    index += occurrence.width;
  }
  return options;
}

/**
 * Options whose output the compiler writes itself, outside the emit: a config
 * route that only collects emitted files cannot produce them.
 */
const COMMAND_LINE_OUTPUTS: ReadonlySet<string> = new Set([
  "project",
  "generateTrace",
  "generateCpuProfile",
  "pprofDir",
]);

/** Members of a command-line list value, as the native parser reads them. */
function splitList(
  value: string,
  enumMembers: boolean,
  filePath: boolean,
  cwd: string,
): string[] {
  // Go strings.TrimSpace follows Unicode White_Space for the whole value;
  // enum members are then trimmed with the compiler's IsWhiteSpaceLike set.
  const trimmed = value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
  if (trimmed === "" || trimmed.startsWith("-")) return [];
  const members: string[] = [];
  for (const part of trimmed.split(",")) {
    const member = enumMembers ? normalizeCompilerEnumValue(part, "cli") : part;
    if (member === null || member === "") continue;
    members.push(filePath ? path.resolve(cwd, member) : member);
  }
  return members;
}

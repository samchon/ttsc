import fs from "node:fs";
import path from "node:path";

import { outputText } from "../../../compiler/internal/outputText";
import { resolveTsgo } from "../../../compiler/internal/resolveTsgo";
import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { spawnNative } from "../../../compiler/internal/spawnNative";
import { runtimeExecutableIdentity } from "../../../internal/runtimeExecutableIdentity";
import { GoEnvironmentReading } from "./GoEnvironmentReading";
import { GoSourceInputs } from "./GoSourceInputs";
import { GoToolResolution } from "./GoToolResolution";
import type { PluginContentIdentities } from "./PluginContentIdentities";
import { PluginLoadAnswers } from "./PluginLoadAnswers";
import { SourcePluginWorkspace } from "./SourcePluginWorkspace";
import { resolveGoCompiler } from "./resolveGoCompiler";

/**
 * The compiler target a source build compiles against, chosen from the
 * TypeScript line the project installs.
 *
 * Each ttsc release ships one shim tree per supported TypeScript minor line:
 * the 7.0 tree over `github.com/microsoft/typescript-go` and the 7.1 bridges
 * and facades over `github.com/microsoft/TypeScript/tsc`. A plugin, the
 * in-memory compiler host and the linked plugin host all build against the
 * target of the project's line. The target pins a default compiler revision. A
 * project can supply compatible Go sources through `TTSC_TSGO_SOURCE`. A newer
 * line uses the newest target after a warning. An unreadable version uses the
 * 7.0 target shipped in every installation.
 *
 * @evidence contracts/common.md#principled-implementation The target follows the installed compiler's major.minor line, the unit at which the shim API is audited; a prerelease of a line such as 7.1.0-dev belongs to that line. A newer line falls back to the newest audited target rather than to an unaudited commit.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns line parsing, version reading and the target's build tag, leaving overlay discovery to SourcePluginWorkspace and builds to buildSourcePlugin.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No project, plugin or fixture name selects a target; only the compiler version does.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the supported lines, the newer-line fallback and the unreadable-version default.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The namespace declaration itself performs no native operation; its members state their own boundaries.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace declaration executes nothing.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace declaration coordinates no work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace declaration retains nothing.
 */
export namespace CompilerTarget {
  /**
   * A supported compiler line: the major.minor of the TypeScript releases one
   * shipped shim tree targets.
   *
   * @evidence contracts/common.md#principled-implementation Each member names a line whose shims this release ships and audits.
   * @evidence contracts/common.md#clear-and-simple-design A closed union lets every switch over targets be checked for completeness.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Members are shipped lines, not installed versions.
   * @evidence contracts/common.md#meaningful-documentation Native prose states what a member names.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation A type performs no native operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type executes nothing.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type coordinates no work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type retains nothing.
   */
  export type Line = "7.0" | "7.1";

  /** The newest supported line, which a newer installed line falls back to. */
  export const NEWEST: Line = "7.1";

  /**
   * The build tag a 7.1 build compiles with; 7.0 builds carry none, so a file
   * marked `!ttsc_typescript_7_1` is the 7.0 side.
   */
  export const TYPESCRIPT_7_1_TAG = "ttsc_typescript_7_1";

  /**
   * The build tag a build compiles with when the compiler source declared in
   * `TTSC_TSGO_SOURCE` contains an `internal/batch` directory; builds without
   * that package carry none, so a file marked `!ttsc_compiler_batch` is the
   * no-op side.
   */
  export const COMPILER_BATCH_TAG = "ttsc_compiler_batch";

  /**
   * The line a compiler version belongs to, and whether that version is newer
   * than every supported line. A version without a readable major.minor maps to
   * 7.0.
   *
   * @evidence contracts/common.md#principled-implementation Reads the leading major.minor of a semver-shaped version, so a prerelease such as 7.1.0-dev.20261019.1 maps to its own line; 7.0 and 7.1 map to themselves, and any later line is newer than the newest target.
   * @evidence contracts/common.md#clear-and-simple-design One pure mapping serves both the manifest and the custom-binary version source.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable text maps to the shipped 7.0 target instead of being guessed.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the prerelease, newer-line and unreadable cases.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The mapping reads its argument only.
   * @evidence contracts/performance.md#efficient-algorithms One anchored regular-expression match over the version text.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The pure mapping coordinates no shared work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The mapping retains nothing.
   */
  export function lineOf(version: string): { line: Line; newer: boolean } {
    const match = /^\s*(?:Version\s+)?(\d+)\.(\d+)/.exec(version);
    if (match === null) return { line: "7.0", newer: false };
    const major = Number(match[1]);
    const minor = Number(match[2]);
    if (major === 7 && minor === 0) return { line: "7.0", newer: false };
    if (major === 7 && minor === 1) return { line: "7.1", newer: false };
    if (major < 7) return { line: "7.0", newer: false };
    return { line: NEWEST, newer: true };
  }

  /**
   * The target for a project: the line of the TypeScript compiler it installs,
   * or of `TTSC_TSGO_BINARY` when that names a custom compiler. A version newer
   * than every target selects the newest and warns once per version on stderr.
   *
   * A ttsx run names the compiler it resolved through `TTSC_TSGO_BINARY`, so
   * every plugin load of its program asked that binary for its version again
   * (samchon/ttsc#1852). With a record store the answer is kept under the
   * binary's content identity (`runtimeExecutableIdentity`) for later
   * processes, as runtime probes are (#1723).
   *
   * @param projectRoot Project whose compiler is resolved.
   * @param env Effective environment of the load.
   * @param identities Optional record store of the project's plugin cache.
   * @param additionalProjectRoots Consumer roots excluded from version scratch.
   * @evidence contracts/common.md#principled-implementation resolveTsgo locates the same compiler the project's build runs; its manifest version is used, and a custom binary is asked for --version since it has no manifest. An unresolvable compiler maps to the 7.0 default, leaving the build's own resolution to report it.
   * @evidence contracts/common.md#clear-and-simple-design Version reading stays here and line mapping in lineOf; callers receive only the line.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The project's real compiler decides the target; no fixture name or path pattern does.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the two version sources and the warning.
   * @evidence contracts/portability.md#os-neutral-implementation resolveTsgo and spawnNative own the native lookup and process launch; the version text is read without shell interpretation.
   * @evidence contracts/performance.md#efficient-algorithms A manifest version costs resolveTsgo's lookup; only a custom binary adds one --version process.
   * @evidence contracts/performance.md#reuse-equivalent-work With a record store, a currently proven executable identity reuses its successful --version answer within and across processes. An unproven identity or failed probe supplies no reusable answer. Installed manifest versions are resolved afresh.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The warned set grows with distinct newer versions for the process lifetime. Version records belong to the disk collector, and synchronous native probes release their process on return.
   */
  export function resolve(
    projectRoot: string,
    env: NodeJS.ProcessEnv,
    identities?: PluginContentIdentities.Store,
    additionalProjectRoots?: readonly string[],
  ): Line {
    const version = installedVersion(
      projectRoot,
      env,
      identities,
      additionalProjectRoots,
    );
    const { line, newer } = lineOf(version);
    if (newer && !warned.has(version)) {
      warned.add(version);
      process.stderr.write(
        `ttsc: TypeScript ${version} is newer than every compiler target this ttsc supports; ` +
          `using the TypeScript ${line} compiler target.\n`,
      );
    }
    return line;
  }

  /**
   * The environment a build of line runs Go with: env itself when neither the
   * 7.1 target tag nor the compiler-batch tag applies, and otherwise env with
   * the applicable ttsc build tags added to the GOFLAGS Go would use, merged
   * into any -tags already set there.
   *
   * `ttsc_typescript_7_1` applies for line 7.1. `ttsc_compiler_batch` applies
   * when the compiler source declared by `TTSC_TSGO_SOURCE` contains an
   * `internal/batch` directory. A GOFLAGS variable replaces the value `go env
   * -w` stored rather than adding to it, so when env sets no GOFLAGS the stored
   * value is asked of Go from cwd and the tags join that.
   *
   * @evidence contracts/common.md#principled-implementation GOFLAGS reaches every go command a build runs, so go list, the package-artifact probe and go build select the same tagged files; an existing -tags list gains the needed tags instead of being replaced, and flags stored by go env -w survive because Go reports them before the variable is set.
   * @evidence contracts/common.md#clear-and-simple-design One environment transform owns both ttsc build tags instead of threading tags through each Go command.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Other GOFLAGS entries are kept unchanged and in order, the stored value comes from Go itself rather than a handwritten environment-file location, and a 7.0 build without a batch-hook compiler source returns env unchanged.
   * @evidence contracts/common.md#meaningful-documentation Native prose states when each tag applies, the merge behavior and why the stored value is read.
   * @evidence contracts/portability.md#os-neutral-implementation Go locates and reads its own environment file; resolveGoCompiler, GoToolResolution and GoEnvironmentReading own the native lookup and launch, and node:path/node:fs check whether the declared compiler source contains an internal/batch directory without platform path assumptions.
   * @evidence contracts/performance.md#efficient-algorithms Observes a declared compiler source and scans the GOFLAGS fields once. Tagged builds that inherit stored flags use a qualified Go answer or run up to three probes to establish its SDK and environment file.
   * @evidence contracts/performance.md#reuse-equivalent-work With a record store the stored value is answered across loads while the file `go env -w` writes, the tool and the variables hold; without one it is read afresh.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned environment is a caller-owned copy, and the go env process is synchronous and released on return.
   */
  export function buildEnv(
    env: NodeJS.ProcessEnv,
    line: Line,
    cwd: string,
    identities?: PluginContentIdentities.Store,
    additionalProjectRoots?: readonly string[],
  ): NodeJS.ProcessEnv {
    const additions: string[] = [];
    if (line === "7.1") additions.push(TYPESCRIPT_7_1_TAG);
    if (hasCompilerBatchPackage(env)) additions.push(COMPILER_BATCH_TAG);
    if (additions.length === 0) return env;
    const current =
      SidecarEnvironment.read(env, "GOFLAGS") ||
      storedGoFlags(env, cwd, identities, additionalProjectRoots);
    const flags = parseFlags(current);
    if (flags === undefined) return env;
    const setting = flags.tags.at(-1);
    const next = flags.fields.map((field) => field.raw);
    if (setting === undefined) next.push(`-tags=${additions.join(",")}`);
    else {
      const missing = additions.filter((tag) => !setting.tags.includes(tag));
      next[setting.index] = renderTags(setting, [...setting.tags, ...missing]);
    }
    const result = SidecarEnvironment.merge(env);
    SidecarEnvironment.write(result, "GOFLAGS", next.join(" "));
    return result;
  }

  /**
   * The line a build environment compiles: 7.1 when Go's effective tags include
   * the 7.1 build tag, otherwise 7.0. A build reads its overlays through this,
   * so the overlaid shim tree is always the one the tagged files were written
   * for.
   *
   * @evidence contracts/common.md#principled-implementation The tag decides which target files Go compiles, so the same tag decides which shim tree they are compiled against; a workspace can never pair 7.1 files with 7.0 shims.
   * @evidence contracts/common.md#clear-and-simple-design The environment a build already carries names its target, so no separate target parameter is threaded through package selection and builds.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only the Go-defined -tags fields are read; other GOFLAGS text cannot select a target.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the tag rule and why builds read it.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation GOFLAGS is a Go-defined space-separated value; the reading touches no native resource.
   * @evidence contracts/performance.md#efficient-algorithms One pass over the GOFLAGS fields.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The pure reading coordinates no shared work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The reading retains nothing.
   */
  export function ofEnv(env: NodeJS.ProcessEnv): Line {
    const text = SidecarEnvironment.read(env, "GOFLAGS");
    if (text === undefined || !text.includes(TYPESCRIPT_7_1_TAG)) return "7.0";
    const flags = parseFlags(text);
    return flags?.tags.at(-1)?.tags.includes(TYPESCRIPT_7_1_TAG) === true
      ? "7.1"
      : "7.0";
  }

  /**
   * GOFLAGS without the build tags ttsc adds (`ttsc_typescript_7_1` and
   * `ttsc_compiler_batch`). Retain a final empty setting when it clears earlier
   * caller tags. Other flags keep their original spellings and order.
   *
   * @evidence contracts/common.md#principled-implementation Both build tags are ttsc's own selection, not the caller's Go environment; the environment digest of a source state omits them so a reader with the caller's environment reproduces the state, while the build key still separates targets and compiler-batch builds through their overlay modules.
   * @evidence contracts/common.md#clear-and-simple-design The inverse of buildEnv's merge lives beside it, so the two cannot disagree on the tags or the -tags syntax.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only the exact ttsc tags are removed; every other tag and flag is kept.
   * @evidence contracts/common.md#meaningful-documentation Native prose states what is removed and what is kept.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation GOFLAGS is a Go-defined space-separated value; the transform touches no native resource.
   * @evidence contracts/performance.md#efficient-algorithms One pass over the GOFLAGS fields.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The pure transform coordinates no shared work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The transform retains nothing.
   */
  export function withoutTag(flags: string): string {
    if (flags.length === 0) return flags;
    const parsed = parseFlags(flags);
    if (parsed === undefined) return flags;
    const fields = parsed.fields.map((field) => field.raw);
    let previousTags = false;
    for (const setting of parsed.tags) {
      const tags = setting.tags.filter(
        (tag) => tag !== TYPESCRIPT_7_1_TAG && tag !== COMPILER_BATCH_TAG,
      );
      fields[setting.index] =
        tags.length !== 0 || previousTags ? renderTags(setting, tags) : "";
      previousTags = tags.length !== 0;
    }
    return fields.filter((field) => field !== "").join(" ");
  }

  interface GoField {
    readonly raw: string;
    readonly value: string;
  }

  interface GoTagSetting {
    readonly index: number;
    readonly name: string;
    readonly tags: string[];
  }

  // Match cmd/internal/quoted.Split: only quotes at the start of a field
  // delimit it, and there is no escape syntax. Preserve unrelated raw fields.
  function splitGoFields(text: string): GoField[] | undefined {
    const token =
      /[ \t\r\n]*(?:'([^']*)'|"([^"]*)"|([^'" \t\r\n][^ \t\r\n]*))/y;
    const fields: GoField[] = [];
    let end = 0;
    for (let part = token.exec(text); part !== null; part = token.exec(text)) {
      end = token.lastIndex;
      fields.push({
        raw: part[0].replace(/^[ \t\r\n]+/, ""),
        value: (part[1] ?? part[2] ?? part[3])!,
      });
    }
    return /[^ \t\r\n]/.test(text.slice(end)) ? undefined : fields;
  }

  function parseFlags(
    text: string,
  ): { fields: GoField[]; tags: GoTagSetting[] } | undefined {
    const fields = splitGoFields(text);
    if (fields === undefined) return undefined;
    const tags: GoTagSetting[] = [];
    for (const [index, field] of fields.entries()) {
      const match = /^(-{1,2}tags=)([\s\S]*)$/.exec(field.value);
      if (match === null) continue;
      const value = match[2]!;
      // cmd/go's tagsFlag uses its legacy quoted list for a space or apostrophe.
      const values = /[ ']/.test(value)
        ? splitGoFields(value)?.map((entry) => entry.value)
        : value.split(",").filter((entry) => entry !== "");
      if (values === undefined) return undefined;
      tags.push({ index, name: match[1]!, tags: values });
    }
    return { fields, tags };
  }

  function renderTags(setting: GoTagSetting, tags: string[]): string {
    if (tags.every((tag) => tag !== "" && !/[, '\t\r\n]/.test(tag)))
      return setting.name + tags.join(",");
    const hasSingle = tags.some((tag) => tag.includes("'"));
    const hasDouble = tags.some((tag) => tag.includes('"'));
    if (hasSingle && hasDouble) {
      // An unquoted legacy value can contain both delimiters as literal
      // characters. Go build constraints cannot name any of those terms.
      return (
        setting.name +
        tags.filter((tag) => /^[\p{L}\p{Nd}_.]+$/u.test(tag)).join(",")
      );
    }
    // Preserve legacy values containing commas as single tags.
    const quote = hasSingle ? '"' : "'";
    const inner = hasSingle ? "'" : '"';
    const entries = tags.map((tag) =>
      tag === "" || /^['"]|[ \t\r\n]/.test(tag)
        ? `${inner}${tag}${inner}`
        : tag,
    );
    return `${quote}${setting.name} ${entries.join(" ")}${quote}`;
  }

  /**
   * Whether the compiler source declared in `TTSC_TSGO_SOURCE` contains an
   * `internal/batch` directory providing the compiler's batch-compilation
   * hook.
   */
  function hasCompilerBatchPackage(env: NodeJS.ProcessEnv): boolean {
    const source = SourcePluginWorkspace.compilerSource(env);
    if (source === undefined) return false;
    try {
      return fs.statSync(path.join(source, "internal", "batch")).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * The GOFLAGS Go reports from cwd, or empty when Go cannot answer. With a
   * record store a later process takes the answer from the record while what it
   * depended on holds (`GoEnvironmentReading.recorded`).
   */
  function storedGoFlags(
    env: NodeJS.ProcessEnv,
    cwd: string,
    identities: PluginContentIdentities.Store | undefined,
    additionalProjectRoots: readonly string[] | undefined,
  ): string {
    const goBinary = GoToolResolution.resolveGoToolForBuild(
      resolveGoCompiler(env).binary,
      env,
      cwd,
    );
    const values = GoEnvironmentReading.recorded(
      goBinary,
      cwd,
      GoSourceInputs.goBuildEnv(goBinary, undefined, env),
      ["GOFLAGS"],
      undefined,
      identities,
      undefined,
      additionalProjectRoots,
    );
    return typeof values?.GOFLAGS === "string" ? values.GOFLAGS : "";
  }

  /** Answer family of custom compiler versions (`PluginLoadAnswers`). */
  const COMPILER_VERSION = "compiler-version";

  const warned = new Set<string>();

  function installedVersion(
    projectRoot: string,
    env: NodeJS.ProcessEnv,
    identities: PluginContentIdentities.Store | undefined,
    additionalProjectRoots: readonly string[] | undefined,
  ): string {
    let tsgo: ReturnType<typeof resolveTsgo>;
    try {
      tsgo = resolveTsgo({ cwd: projectRoot, env });
    } catch {
      return "unknown";
    }
    if (tsgo.version !== "custom") return tsgo.version;
    const before =
      identities === undefined
        ? undefined
        : runtimeExecutableIdentity(tsgo.binary, identities);
    if (before !== undefined) {
      const recorded = PluginLoadAnswers.read(identities, COMPILER_VERSION, [
        tsgo.binary,
        before,
      ]);
      if (typeof recorded === "string") return recorded;
    }
    const result = spawnNative(tsgo.binary, ["--version"], {
      additionalProjectRoots,
      cwd: projectRoot,
      env,
    });
    const answered = result.error === undefined && result.status === 0;
    const version = answered ? outputText(result.stdout).trim() : "unknown";
    // Recorded only for the bytes that answered: unchanged around the run.
    if (
      answered &&
      before !== undefined &&
      runtimeExecutableIdentity(tsgo.binary, identities) === before
    )
      PluginLoadAnswers.write(
        identities,
        COMPILER_VERSION,
        [tsgo.binary, before],
        version,
      );
    return version;
  }
}

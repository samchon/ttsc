import { outputText } from "../../../compiler/internal/outputText";
import { resolveTsgo } from "../../../compiler/internal/resolveTsgo";
import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { spawnNative } from "../../../compiler/internal/spawnNative";

/**
 * The compiler target a source build compiles against, chosen from the
 * TypeScript line the project installs.
 *
 * Each ttsc release ships one shim tree per supported TypeScript minor line:
 * the 7.0 tree over `github.com/microsoft/typescript-go` and the 7.1 bridges
 * and facades over `github.com/microsoft/TypeScript/tsc`. A plugin, the
 * in-memory compiler host and the linked plugin host all build against the
 * target of the project's line, so their checker is the compiler the project's
 * own `tsc` runs. A line newer than every target builds with the newest one,
 * after a warning; a version ttsc cannot read builds with the 7.0 target, which
 * every installation ships.
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
   * @evidence contracts/common.md#principled-implementation resolveTsgo locates the same compiler the project's build runs; its manifest version is used, and a custom binary is asked for --version since it has no manifest. An unresolvable compiler maps to the 7.0 default, leaving the build's own resolution to report it.
   * @evidence contracts/common.md#clear-and-simple-design Version reading stays here and line mapping in lineOf; callers receive only the line.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The project's real compiler decides the target; no fixture name or path pattern does.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the two version sources and the warning.
   * @evidence contracts/portability.md#os-neutral-implementation resolveTsgo and spawnNative own the native lookup and process launch; the version text is read without shell interpretation.
   * @evidence contracts/performance.md#efficient-algorithms A manifest version costs resolveTsgo's lookup; only a custom binary adds one --version process.
   * @evidence contracts/performance.md#reuse-equivalent-work Custom-binary versions are remembered per binary path for the process, since the binary at a path does not change its line mid-process; manifest versions are read afresh because projects differ.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The remembered map grows with distinct custom binary paths and the warned set with distinct newer versions, both for the process lifetime; the spawned process is synchronous and released on return.
   */
  export function resolve(projectRoot: string, env: NodeJS.ProcessEnv): Line {
    const version = installedVersion(projectRoot, env);
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
   * The environment a build of line runs Go with: env itself for 7.0, and for
   * 7.1 env with the 7.1 build tag added to GOFLAGS, merged into any -tags the
   * caller already set.
   *
   * @evidence contracts/common.md#principled-implementation GOFLAGS reaches every go command a build runs, so go list, the package-artifact probe and go build select the same tagged files; an existing -tags list gains the tag instead of being replaced.
   * @evidence contracts/common.md#clear-and-simple-design One environment transform per target replaces threading tags through each command.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Other GOFLAGS entries are kept unchanged and in order.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the per-line result and the merge.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation GOFLAGS is a Go-defined space-separated value; the transform reads and writes no native resource.
   * @evidence contracts/performance.md#efficient-algorithms One pass over the GOFLAGS fields.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The transform coordinates no shared work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned environment is a caller-owned copy.
   */
  export function buildEnv(
    env: NodeJS.ProcessEnv,
    line: Line,
  ): NodeJS.ProcessEnv {
    if (line !== "7.1") return env;
    const current = SidecarEnvironment.read(env, "GOFLAGS") ?? "";
    const fields = current.split(/\s+/).filter((field) => field !== "");
    let tagged = false;
    const next = fields.map((field) => {
      const match = /^(-{1,2}tags=)(.*)$/.exec(field);
      if (match === null) return field;
      tagged = true;
      const tags = match[2]!.split(",").filter((tag) => tag !== "");
      if (!tags.includes(TYPESCRIPT_7_1_TAG)) tags.push(TYPESCRIPT_7_1_TAG);
      return `${match[1]}${tags.join(",")}`;
    });
    if (!tagged) next.push(`-tags=${TYPESCRIPT_7_1_TAG}`);
    const result = SidecarEnvironment.merge(env);
    SidecarEnvironment.write(result, "GOFLAGS", next.join(" "));
    return result;
  }

  /**
   * The line a build environment compiles: 7.1 when its GOFLAGS carries the 7.1
   * build tag, otherwise 7.0. A build reads its overlays through this, so the
   * overlaid shim tree is always the one the tagged files were written for.
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
    const flags = SidecarEnvironment.read(env, "GOFLAGS") ?? "";
    for (const field of flags.split(/\s+/)) {
      const match = /^-{1,2}tags=(.*)$/.exec(field);
      if (match !== null && match[1]!.split(",").includes(TYPESCRIPT_7_1_TAG))
        return "7.1";
    }
    return "7.0";
  }

  /**
   * GOFLAGS without the 7.1 build tag ttsc adds: the tag leaves every -tags
   * list, an emptied list leaves the flags, and every other field stays in
   * order.
   *
   * @evidence contracts/common.md#principled-implementation The target tag is ttsc's own selection, not the caller's Go environment; the environment digest of a source state omits it so a reader with the caller's environment reproduces the state, while the build key still separates targets through their overlay modules.
   * @evidence contracts/common.md#clear-and-simple-design The inverse of buildEnv's merge lives beside it, so the two cannot disagree on the tag or the -tags syntax.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only the exact ttsc tag is removed; every other tag and flag is kept.
   * @evidence contracts/common.md#meaningful-documentation Native prose states what is removed and what is kept.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation GOFLAGS is a Go-defined space-separated value; the transform touches no native resource.
   * @evidence contracts/performance.md#efficient-algorithms One pass over the GOFLAGS fields.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The pure transform coordinates no shared work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The transform retains nothing.
   */
  export function withoutTag(flags: string): string {
    return flags
      .split(/\s+/)
      .filter((field) => field !== "")
      .flatMap((field) => {
        const match = /^(-{1,2}tags=)(.*)$/.exec(field);
        if (match === null) return [field];
        const tags = match[2]!
          .split(",")
          .filter((tag) => tag !== "" && tag !== TYPESCRIPT_7_1_TAG);
        return tags.length === 0 ? [] : [`${match[1]}${tags.join(",")}`];
      })
      .join(" ");
  }

  const warned = new Set<string>();
  const customVersions = new Map<string, string>();

  function installedVersion(
    projectRoot: string,
    env: NodeJS.ProcessEnv,
  ): string {
    let tsgo: ReturnType<typeof resolveTsgo>;
    try {
      tsgo = resolveTsgo({ cwd: projectRoot, env });
    } catch {
      return "unknown";
    }
    if (tsgo.version !== "custom") return tsgo.version;
    const known = customVersions.get(tsgo.binary);
    if (known !== undefined) return known;
    const result = spawnNative(tsgo.binary, ["--version"], {
      cwd: projectRoot,
      env,
    });
    const version =
      result.error === undefined && result.status === 0
        ? outputText(result.stdout).trim()
        : "unknown";
    customVersions.set(tsgo.binary, version);
    return version;
  }
}

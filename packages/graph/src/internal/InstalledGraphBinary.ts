import { createRequire } from "node:module";
import path from "node:path";

/**
 * The native `ttscgraph` producer installed with this `@ttsc/graph` release.
 *
 * `@ttsc/graph` lists one `@ttsc/graph-<platform>-<arch>` package per supported
 * target as an exact-version optional dependency. The producer is therefore
 * resolved from `@ttsc/graph`'s own installation, not from the project being
 * graphed: the JavaScript client and its native producer always come from one
 * release, and the directory a launcher starts in does not affect which binary
 * runs.
 *
 * @evidence contracts/common.md#principled-implementation Node module resolution from a file inside the installed package finds the optional platform dependency wherever the package manager placed it; an explicit absolute override keeps precedence.
 * @evidence contracts/common.md#clear-and-simple-design One owner holds the resolution order and the two remedies every launcher, loader and session reports, so their wording cannot drift.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Resolution uses the installed package contract rather than repository layouts, the target project's packages or guessed paths.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why the producer belongs to this package and what the anchor means.
 * @evidence contracts/portability.md#os-neutral-implementation The platform and architecture name the package and Windows alone adds the executable suffix; Node module resolution handles symlinked and hoisted layouts on every host.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Resolution returns a path string and opens no handle.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Each member performs at most one module resolution or builds one string.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Resolution runs once per launch and caches nothing, so a reinstall between launches is honored.
 */
export namespace InstalledGraphBinary {
  /**
   * Resolve the producer, or `null` when nothing supplies one.
   *
   * 1. `TTSC_GRAPH_BINARY` when it is an absolute path. It is returned without a
   *    filesystem probe, so the spawn owns its executable error; a relative
   *    value is ignored.
   * 2. `@ttsc/graph-<platform>-<arch>/bin/ttscgraph[.exe]`, resolved by Node
   *    module resolution from `anchor`, a file inside the installed
   *    `@ttsc/graph` package.
   *
   * @evidence contracts/common.md#principled-implementation An absolute override is honored before module resolution walks up from the anchor to the package manager's placement of the platform dependency.
   * @evidence contracts/common.md#clear-and-simple-design The function owns precedence and lookup; callers own the failure presentation through the shared remedies.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing package resolves to null instead of a guessed path, and the override is not probed on the caller's behalf.
   * @evidence contracts/common.md#meaningful-documentation The numbered list states the precedence, the anchor's meaning and the unprobed override.
   * @evidence contracts/portability.md#os-neutral-implementation path.isAbsolute applies the host's absolute-path rule, and the package and executable names come from process.platform and process.arch.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns a path string and opens no handle.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Performs at most one module resolution.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Resolves on every call so a reinstall is honored.
   */
  export function resolve(
    env: NodeJS.ProcessEnv,
    anchor: string,
  ): string | null {
    const override = env.TTSC_GRAPH_BINARY;
    if (override && path.isAbsolute(override)) return override;
    try {
      return createRequire(anchor).resolve(
        `${packageName()}/bin/${process.platform === "win32" ? "ttscgraph.exe" : "ttscgraph"}`,
      );
    } catch {
      return null;
    }
  }

  /**
   * The platform package this process's target selects.
   *
   * @evidence contracts/common.md#principled-implementation The npm platform and architecture strings are the package name's only variable parts.
   * @evidence contracts/common.md#clear-and-simple-design Resolution and the missing-package diagnostic share this one name.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No platform table or alias substitutes for the actual target names.
   * @evidence contracts/common.md#meaningful-documentation The native headline states what the name selects.
   * @evidence contracts/portability.md#os-neutral-implementation process.platform and process.arch already carry npm's os and cpu spellings, which the platform manifests declare.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Builds a string and holds nothing.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Concatenates two process properties.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A constant-time string needs no sharing.
   */
  export function packageName(): string {
    return `@ttsc/graph-${process.platform}-${process.arch}`;
  }

  /**
   * The diagnostic a launcher, loader or session reports when resolution fails.
   *
   * @evidence contracts/common.md#principled-implementation The remedy names the actual package that resolution looked for and the override that bypasses it.
   * @evidence contracts/common.md#clear-and-simple-design Every failing entry point reports this one text.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The text describes the real installation contract rather than a repository path.
   * @evidence contracts/common.md#meaningful-documentation The native headline states when the diagnostic applies.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Builds a message; the package name carries the only platform-dependent part.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Builds a string and holds nothing.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Concatenates constant text with the package name.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Called once per failed resolution.
   */
  export function missingMessage(): string {
    return (
      "@ttsc/graph: could not resolve the ttscgraph binary. " +
      `Install @ttsc/graph with its optional dependencies so ${packageName()} is present, ` +
      "or set TTSC_GRAPH_BINARY to an absolute path."
    );
  }

  /**
   * The remedy appended to a serve-protocol or dump-schema mismatch. The
   * installed platform package always matches its `@ttsc/graph` release, so a
   * mismatch means a stale installation or an override naming another build.
   */
  export const MISMATCH_REMEDY =
    "Reinstall @ttsc/graph so its platform package matches this client, " +
    "or point TTSC_GRAPH_BINARY at a matching ttscgraph.";
}

import path from "node:path";

import type { TtscCommonOptions } from "../../../structures/internal/TtscCommonOptions";
import type { BuildExecution } from "./BuildExecution";
import { PassthroughFlags } from "./PassthroughFlags";
import type { RunBuildOptions } from "./RunBuildOptions";

/**
 * The argv ttsc hands to TypeScript-Go, directly or through a native host.
 *
 * One place composes the forwarded user flags with the flags ttsc itself must
 * add: the pinned `rootDir` for an injected `outDir`, the output sandbox of a
 * private build, threading, and emitted-file listing. Ordering is part of the
 * contract. ttsc's own additions come first so a flag the user forwarded wins,
 * except for output isolation and the requested noEmitOnError guard, which
 * follow forwarded arguments to enforce the private-build and emission policy.
 *
 * @evidence contracts/common.md#principled-implementation Shared composition preserves user precedence for defaults and authoritative final guards for private output and error policy across direct argv and native compiler payloads.
 * @evidence contracts/common.md#clear-and-simple-design Compiler argument policy has one grouping, with separate helpers for diagnostics, threading, inferred layout and output isolation rather than lane-specific copies.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported compiler options and the driver environment protocol express requirements without patching compiler APIs or injecting unknown flags into foreign hosts.
 * @evidence contracts/common.md#meaningful-documentation Namespace prose explicitly documents ordering exceptions; native function paragraphs explain layout, option transport and private output effects.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The grouping has no native operation of its own; selected argv/payload composers acknowledge native path and process representations they carry.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Selected argument composers own traversal and encoding costs; this namespace is only their API grouping.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work No payload or compiler computation is retained by the grouping.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace acquires no child, output directory or persistent cache.
 */
export namespace TsgoArguments {
  /**
   * Compose a direct compiler command with explicit project selection. User
   * flags follow ordinary internal defaults; sandbox locations and a requested
   * noEmitOnError guard follow user flags and remain authoritative.
   *
   * @evidence contracts/common.md#principled-implementation Ordered argv applies explicit emit selection, project-derived root layout and forwarding before enforcing private output isolation and the requested error guard.
   * @evidence contracts/common.md#clear-and-simple-design Shared helpers compose diagnostics, threading and isolation while this operation owns direct-compiler ordering and emit policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Inferred-root pinning addresses only caller-injected output layout; ordinary user output requests and declared rootDir retain compiler semantics rather than receiving blanket suppression.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains which defaults users can override and which final guards remain authoritative; private root-layout documentation supplies its premise.
   * @evidence contracts/portability.md#os-neutral-implementation node:path resolves native output locations against execution cwd, selected tsconfig spelling is preserved and each argument is passed separately without shell quoting.
   * @evidence contracts/performance.md#efficient-algorithms Argument composition appends selected fields and forwarded argv once, with cost proportional to argument count and text.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This builds current command data and coordinates no shared compiler execution or retained options result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned argv transfers to the spawning boundary; no compiler process or persistent cache is owned here.
   */
  export function createTsgoBuildArgs(
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
    options: RunBuildOptions,
    flags: { listEmittedFiles: boolean; noEmitOnError?: boolean },
  ): string[] {
    const args = ["-p", execution.tsconfig];
    if (options.emit === true) {
      args.push("--noEmit", "false", "--emitDeclarationOnly", "false");
      if (execution.rewriteRelativeImportExtensionsForEmit) {
        args.push("--rewriteRelativeImportExtensions");
      }
      // The ttsx runtime build asks for an external map when the project emits
      // none, so its served emit carries a map to inline under the source URL.
      // Pushed before passthrough so an explicit user `--sourceMap` still wins.
      if (options.forceRuntimeSourceMap === true) {
        args.push("--sourceMap", "true");
      }
      // Pushed before passthrough for the same reason: a user `--rootDir` still
      // wins over the value ttsc pins for its own injected `outDir`.
      args.push(...pinnedRootDirArgs(execution, options));
    } else if (options.emit === false) {
      args.push("--noEmit");
    }
    if (options.outDir) {
      args.push("--outDir", path.resolve(execution.cwd, options.outDir));
    }
    if (flags.listEmittedFiles) {
      args.push("--listEmittedFiles");
    }
    args.push(...createTsgoDiagnosticArgs(options));
    args.push(...createTsgoThreadingArgs(options));
    args.push(...(options.passthrough ?? []));
    args.push(...isolatedTsgoOutputArgs(options));
    if (flags.noEmitOnError === true) {
      args.push("--noEmitOnError");
    }
    return args;
  }

  /**
   * The explicit `--rootDir` a caller-injected `outDir` needs, or nothing.
   *
   * See {@link RunBuildOptions.pinInferredRootDir} for why an injected `outDir`
   * needs one at all. Three conditions gate it, and each one is load-bearing:
   *
   * - The caller injected the `outDir` itself, so a user `--outDir` keeps tsgo's
   *   own TS5011 answer;
   * - This pass emits, because a no-emit pass has no layout to pin (tsgo skips
   *   the check for `noEmit` too);
   * - The project declares no `rootDir` of its own, so a declared layout is never
   *   overridden.
   *
   * `execution.projectRoot` is the directory of the tsconfig ttsc resolved and
   * hands tsgo as `-p`, which is exactly the directory tsgo infers, and it is
   * spelled the way tsgo will spell the input file names it compares against it
   * — both come from the same `fs.realpathSync` pass. Resolving it any further
   * (a Windows 8.3 expansion, say) would leave the comparison lexically mixed,
   * and `ContainsPath` is lexical: every input would count as outside `rootDir`
   * and tsgo would emit it beside the user's source instead of under `outDir`.
   */
  function pinnedRootDirArgs(
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
    options: RunBuildOptions,
  ): string[] {
    if (options.pinInferredRootDir !== true) return [];
    if (options.emit !== true) return [];
    if (typeof execution.project.compilerOptions.rootDir === "string")
      return [];
    return ["--rootDir", execution.projectRoot];
  }

  /**
   * Return `["--pretty", "false"]` when structured diagnostics are requested so
   * that the output can be parsed line-by-line, or an empty array otherwise.
   *
   * When the user explicitly forwarded `--pretty` (any value), the internal
   * `--pretty false` shadow is dropped so the user wins on the surface. ttsc's
   * own diagnostic parser will then see pretty-formatted output and fall back
   * to preserving text it cannot parse. Presence is recognized even for a
   * malformed inline spelling, which remains for the compiler to reject.
   *
   * @evidence contracts/common.md#principled-implementation Structured output requests add nonpretty rendering only when the user supplied no pretty option identity; explicit or malformed user spelling stays under compiler ownership.
   * @evidence contracts/common.md#clear-and-simple-design One guard delegates shadow identity to PassthroughFlags and returns the protocol's two-token default or no additions.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A user-owned option is not erased to force parseable output; malformed spelling remains available for the real compiler diagnostic.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain parseability, user precedence and preservation of malformed inline spelling.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Selecting compiler option tokens does not inspect paths, filesystem capabilities or a native process.
   *
   * @evidence contracts/performance.md#efficient-algorithms A disabled structured request exits immediately; otherwise one short-circuit argv presence scan selects a fixed-size result.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This option adapter coordinates no completed or in-flight producer across requests.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only a returned small argv array is allocated and no retained resource is acquired.
   */
  export function createTsgoDiagnosticArgs(
    options: TtscCommonOptions,
  ): string[] {
    if (options.structuredDiagnostics !== true) return [];
    if (PassthroughFlags.forwardsInternalShadowFlag(options, "--pretty"))
      return [];
    return ["--pretty", "false"];
  }

  /**
   * Forward the `--singleThreaded` / `--checkers` knobs to a `tsgo` invocation.
   * tsgo accepts both flags natively, so the no-plugin build lane only has to
   * pass them through; the type-check and emit passes share this so the checker
   * pool size stays consistent across both.
   *
   * @evidence contracts/common.md#principled-implementation Explicit single-thread selection and checker count map directly to compiler-supported flags without changing user values.
   * @evidence contracts/common.md#clear-and-simple-design One helper supplies the same threading mapping to check and emit commands while host capability policy remains in the native-host composer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This uses native compiler options rather than monkey-patching worker creation or introducing benchmark-specific serial behavior.
   * @evidence contracts/common.md#meaningful-documentation Native prose states compiler support and why check and emit share this mapping.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Threading option-token construction does not access platform paths, filesystem capabilities or spawn a process.
   *
   * @evidence contracts/performance.md#efficient-algorithms At most three argv tokens are produced from two scalar option checks.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Mapping scalars to command tokens establishes no shared task or cross-request producer.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The small returned array owns no retained task, handle or cache.
   */
  export function createTsgoThreadingArgs(
    options: TtscCommonOptions,
  ): string[] {
    const args: string[] = [];
    if (options.singleThreaded === true) {
      args.push("--singleThreaded");
    }
    if (options.checkers !== undefined) {
      args.push("--checkers", String(options.checkers));
    }
    return args;
  }

  /**
   * The forwarded-tsgo payload for a native `build`/`check` emit invocation.
   *
   * The sidecar builds its Program in-process, so the pinned `rootDir` has to
   * travel the same channel every other tsgo option takes to it — the host flag
   * set does not declare `--rootDir`, and `filterHostArgs` would strip it.
   *
   * @evidence contracts/common.md#principled-implementation The same project-derived inferred root used by direct builds is placed in the sidecar compiler-option channel, preserving emit layout without requiring a new host flag.
   * @evidence contracts/common.md#clear-and-simple-design Root pinning stays in one helper and general payload ordering/serialization stays in createNativeTsgoArgs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The supported environment payload carries compiler options instead of injecting unknown flags into strict foreign host parsers.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains why rootDir travels with compiler options rather than through the host flag set.
   * @evidence contracts/portability.md#os-neutral-implementation The already-selected native project-root spelling is preserved in JSON argv, avoiding further alias expansion or shell/path quoting.
   * @evidence contracts/performance.md#efficient-algorithms Constant root selection precedes one forwarded-argv serialization, costing O(payload bytes).
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This adapter composes one current payload without caching project-derived argv across invocations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned JSON is transferred to the process boundary; no retained process or cache is owned.
   */
  export function createNativeBuildTsgoArgs(
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
    options: RunBuildOptions,
  ): string | undefined {
    return createNativeTsgoArgs(options, pinnedRootDirArgs(execution, options));
  }

  /**
   * Forward the tsgo flags ttsc did not recognize to a native sidecar as one
   * JSON-encoded payload. The sidecar replays them through tsgo's own option
   * parser onto `CompilerOptions`, so a flag like `ttsc --strict` reaches a
   * plugin build the same way it reaches the plain tsgo lane.
   *
   * The payload travels in the `TTSC_TSGO_ARGS` environment variable, not on
   * the sidecar's command line. #113 shipped it as a `--tsgo-args` flag, which
   * is an addition to a plugin protocol third-party hosts had already frozen: a
   * Go `flag.FlagSet` created with `flag.ContinueOnError` treats an undeclared
   * flag as fatal, so every pre-#113 sidecar answered `flag provided but not
   * defined: -tsgo-args` and exited 2. That took down `ttsc --strict`, `ttsc
   * --declaration`, `ttsx --strict` and — because {@link isolatedTsgoOutputArgs}
   * makes this payload non-empty on its own — plain `ttsc <file.ts>`, on every
   * project carrying a typia/nestia-era transform host (issue #1188).
   *
   * The environment is the channel ttsc already uses for host-owned payloads
   * that must not collide with a third-party flag set
   * (`TTSC_LINKED_PLUGINS_JSON`, `TTSC_PLUGIN_CONFIG_DIR`). It reaches those
   * hosts without any change on their side, because
   * `buildSourcePlugin.ts::sourceBuildWorkspaceReplacements` builds every
   * source plugin against the installed ttsc's own driver, and
   * `driver.LoadProgram` reads the variable whenever the caller supplied no
   * explicit argv. It is strictly better than the capability gate `ad3443a`
   * used for `--singleThreaded` / `--checkers`: that one drops the flag for
   * hosts that cannot take it, which is acceptable for a threading knob and not
   * for `--strict`.
   *
   * Returns the JSON payload, or `undefined` when this lane forwards nothing.
   *
   * @evidence contracts/common.md#principled-implementation Leading internal defaults precede preserved compiler flags, and isolation overrides follow them; JSON retains exact argv boundaries for driver option replay.
   * @evidence contracts/common.md#clear-and-simple-design Compiler forwarding, host timing exclusion and private isolation are composed once behind the environment-payload boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Environment transport is an actual driver protocol that avoids unsupported foreign host flags; invalid compiler arguments remain for the compiler to report.
   * @evidence contracts/common.md#meaningful-documentation Native documentation identifies payload transport, precedence and the undefined outcome; descriptive paragraphs are separated from acknowledgment tags.
   * @evidence contracts/portability.md#os-neutral-implementation JSON argv crosses the native environment boundary without shell construction; output isolation uses native node:path while forwarded paths retain caller spelling.
   * @evidence contracts/performance.md#efficient-algorithms Filtering and serialization scan argv once each, with storage proportional to total payload bytes.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current mutable options are composed directly; sharing sidecar startup belongs to the watch session's complete execution identity.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The payload composer retains no environment, process or history after returning text.
   */
  export function createNativeTsgoArgs(
    options: TtscCommonOptions,
    leading: readonly string[] = [],
  ): string | undefined {
    const passthrough = [
      // Ahead of the user's own flags, so the same precedence holds here as on
      // the direct tsgo lane: whatever the user forwarded wins.
      ...leading,
      ...(nativeTsgoPassthroughArgs(options) ?? []),
      ...isolatedTsgoOutputArgs(options),
    ];
    if (passthrough.length === 0) {
      return undefined;
    }
    return JSON.stringify(passthrough);
  }

  /**
   * The arguments that keep every output of a build in `isolateOutputsTo`, or
   * nothing when the caller asked for no isolation.
   *
   * They null each separately located output (`outFile`, `declarationDir`,
   * `tsBuildInfoFile`) and pin `outDir`, so declarations and build information
   * land beside the JavaScript. Callers append them after the forwarded flags,
   * which makes them win over a location the user forwarded too. A `--noEmit`
   * pass needs them as much as an emitting one: the compiler still writes build
   * information for an `incremental` project.
   *
   * @evidence contracts/common.md#principled-implementation Disabling separately located outputs and pinning outDir closes declaration, bundled and build-info escape paths, including no-emit incremental writes.
   * @evidence contracts/common.md#clear-and-simple-design A fixed compiler-option bundle owns sandbox output policy and both direct and native payload composers place it after forwarded options.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler-supported null option values clear separate destinations instead of intercepting filesystem writes or changing foreign compiler internals.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain affected outputs, final precedence and why no-emit builds still require isolation.
   * @evidence contracts/portability.md#os-neutral-implementation node:path resolves the private target using host-native rules and sends it as one argv value, preserving drive and separator semantics without shell parsing.
   * @evidence contracts/performance.md#efficient-algorithms One target resolution constructs a fixed eight-token bundle; absent isolation exits without allocating output tokens.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This returns current isolation options and coordinates no reusable producer or cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Argument construction does not acquire the output directory or manage its lifetime; the private-build owner does.
   */
  export function isolatedTsgoOutputArgs(options: TtscCommonOptions): string[] {
    const target =
      "isolateOutputsTo" in options &&
      typeof options.isolateOutputsTo === "string"
        ? path.resolve(options.isolateOutputsTo)
        : undefined;
    if (target === undefined) return [];
    return [
      "--outFile",
      "null",
      "--declarationDir",
      "null",
      "--tsBuildInfoFile",
      "null",
      "--outDir",
      target,
    ];
  }

  function nativeTsgoPassthroughArgs(
    options: TtscCommonOptions,
  ): readonly string[] | undefined {
    const passthrough = options.passthrough;
    if (passthrough === undefined) return undefined;
    // A native host reports timing through its own channel, so the timing
    // flags themselves never travel in its tsgo payload.
    return PassthroughFlags.withoutBooleanFlags(passthrough, [
      "--diagnostics",
      "--extendedDiagnostics",
    ]);
  }
}

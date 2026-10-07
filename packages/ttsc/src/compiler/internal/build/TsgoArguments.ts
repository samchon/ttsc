import path from "node:path";

import type { TtscCommonOptions } from "../../../structures/internal/TtscCommonOptions";
import type { BuildExecution } from "./BuildExecution";
import { PassthroughFlags } from "./PassthroughFlags";
import type { RunBuildOptions } from "./RunBuildOptions";
import { privateRuntimeRootDir } from "./privateRuntimeRootDir";

/**
 * The argv ttsc hands to TypeScript-Go, directly or through a native host.
 *
 * One place composes the forwarded user flags with the flags ttsc itself must
 * add: the pinned `rootDir` for an injected `outDir`, the compiler-output
 * isolation of a private build, threading, and emitted-file listing. Ordering
 * is part of the contract. Ordinary defaults precede forwarded arguments;
 * direct commands then append output isolation and the requested noEmitOnError
 * guard. Native JSON payloads likewise append isolation, while their host owns
 * its emit-error policy.
 *
 * @evidence contracts/common.md#principled-implementation Shared composition orders defaults before forwarded options and places private-output overrides last in direct argv and native payloads; the requested noEmitOnError guard is appended by the direct composer, while native host emission policy has its own owner.
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
   * - The caller requested pinInferredRootDir for its injected layout; this
   *   helper does not independently verify that an outDir was injected;
   * - This pass emits, because a no-emit pass has no layout to pin (tsgo skips
   *   the check for `noEmit` too);
   * - The runtime supplies its already selected effective layout, or the project
   *   declares no root of its own. Without runtime selection a declared layout
   *   is left to the compiler; supplied selection preserves the effective
   *   declared root or explicit reset and is replayed before user arguments.
   *
   * An ordinary undeclared root uses the native volume root for private output,
   * avoiding a new containment restriction on imported sources. Composite
   * projects retain their config-root restriction. Explicit user roots still
   * win; selected lexical paths do not establish filesystem identity.
   */
  function pinnedRootDirArgs(
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
    options: RunBuildOptions,
  ): string[] {
    if (options.pinInferredRootDir !== true) return [];
    if (options.emit !== true) return [];
    if (options.privateEmitRootDir !== undefined)
      return ["--rootDir", options.privateEmitRootDir];
    if (typeof execution.project.compilerOptions.rootDir === "string")
      return [];
    return [
      "--rootDir",
      privateRuntimeRootDir(
        execution.projectRoot,
        undefined,
        execution.project.compilerOptions.composite,
      ),
    ];
  }

  /**
   * Return `["--pretty", "false"]` when structured diagnostics are requested so
   * that the output can be parsed line-by-line, or an empty array otherwise.
   *
   * When the user explicitly forwarded `--pretty` (any value), the internal
   * `--pretty false` shadow is dropped so the user wins on the surface. ttsc's
   * own diagnostic parser then sees the user-selected rendering and preserves
   * text it cannot parse; an explicit false still selects nonpretty output.
   * Presence is recognized even for a malformed inline spelling, which remains
   * for the compiler to reject.
   *
   * @evidence contracts/common.md#principled-implementation Structured output requests add nonpretty rendering only when the user supplied no pretty option identity; explicit or malformed user spelling stays under compiler ownership.
   * @evidence contracts/common.md#clear-and-simple-design One guard delegates shadow identity to PassthroughFlags and returns the protocol's two-token default or no additions.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A user-owned option is not erased to force parseable output; malformed spelling remains available for the real compiler diagnostic.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain parseability, user precedence and preservation of malformed inline spelling.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Selecting compiler option tokens does not inspect paths, filesystem capabilities or a native process.
   *
   * @evidence contracts/performance.md#efficient-algorithms A disabled structured request exits immediately; otherwise the delegated short-circuit presence scan includes option identity/name text classification before returning a fixed-size token result.
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
   * @evidence contracts/common.md#principled-implementation The same private layout root used by direct builds is placed in the sidecar compiler-option channel, preserving declared/composite containment while avoiding a new ordinary config-directory restriction without a new host flag.
   * @evidence contracts/common.md#clear-and-simple-design Root pinning stays in one helper and general payload ordering/serialization stays in createNativeTsgoArgs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The supported environment payload carries compiler options instead of injecting unknown flags into strict foreign host parsers.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains why rootDir travels with compiler options rather than through the host flag set.
   * @evidence contracts/portability.md#os-neutral-implementation The already-selected native project-root spelling is preserved in JSON argv, avoiding further alias expansion or shell/path quoting.
   * @evidence contracts/performance.md#efficient-algorithms Root selection precedes delegated visible-option filtering, isolation path resolution, argv copies and JSON serialization. Work/storage follow argument count, normalization/lookahead text and serialized payload/path bytes.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This adapter composes one current payload without caching project-derived argv across invocations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned JSON is transferred to the process boundary; no retained process or cache is owned.
   */
  export function createNativeBuildTsgoArgs(
    execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
    options: RunBuildOptions,
  ): string | undefined {
    return createNativeTsgoArgs(
      options,
      pinnedRootDirArgs(execution, options),
      false,
    );
  }

  /**
   * Forward the tsgo flags ttsc did not recognize to a native sidecar as one
   * JSON-encoded payload. The sidecar replays them through tsgo's own option
   * parser onto `CompilerOptions`, so a flag like `ttsc --strict` reaches a
   * plugin build the same way it reaches the plain tsgo lane.
   *
   * The payload travels in `TTSC_TSGO_ARGS`, avoiding a new host command-line
   * flag that an older strict host parser may reject. Hosts using the shipped
   * driver's LoadProgram read this environment fallback only when their caller
   * supplied no explicit argv; an explicit empty argv also overrides it.
   * Recognized visible diagnostics assignments are omitted for the host's own
   * timing channel. Response-file contents remain under native expansion. This
   * transport preserves remaining argv boundaries, not a guarantee that every
   * third-party host consumes the fallback or accepts every forwarded flag.
   *
   * Returns the JSON payload, or `undefined` when this lane forwards nothing.
   * Check callers use diagnostic-only destinations by default. The build
   * composer explicitly selects emission destinations so a recovery check
   * cannot replace the API's emitted incremental artifact.
   *
   * @evidence contracts/common.md#principled-implementation Leading internal defaults precede preserved compiler flags, and isolation overrides follow them; JSON retains exact argv boundaries for driver option replay.
   * @evidence contracts/common.md#clear-and-simple-design Compiler forwarding, host timing exclusion and private isolation are composed once behind the environment-payload boundary.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Environment transport is an actual driver protocol that avoids unsupported foreign host flags; invalid compiler arguments remain for the compiler to report.
   * @evidence contracts/common.md#meaningful-documentation Native documentation identifies payload transport, precedence and the undefined outcome; descriptive paragraphs are separated from acknowledgment tags.
   * @evidence contracts/portability.md#os-neutral-implementation JSON argv crosses the native environment boundary without shell construction; output isolation uses native node:path while forwarded paths retain caller spelling.
   * @evidence contracts/performance.md#efficient-algorithms Delegated visible-option filtering includes occurrence/name/value/lookahead costs; leading/retained/isolation argv copies precede JSON serialization. Work/storage follow argument count and token/path/payload bytes; returned text does not bound native downstream work.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current mutable options are composed directly; sharing sidecar startup belongs to the watch session's complete execution identity.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The payload composer retains no environment, process or history after returning text.
   */
  export function createNativeTsgoArgs(
    options: RunBuildOptions,
    leading: readonly string[] = [],
    diagnosticsOnly = true,
  ): string | undefined {
    const passthrough = [
      // Ahead of the user's own flags, so the same precedence holds here as on
      // the direct tsgo lane: whatever the user forwarded wins.
      ...leading,
      ...(nativeTsgoPassthroughArgs(options) ?? []),
      ...isolatedTsgoOutputArgs(options, diagnosticsOnly),
    ];
    if (passthrough.length === 0) {
      return undefined;
    }
    return JSON.stringify(passthrough);
  }

  /**
   * The arguments that keep every output of a build in `isolateOutputsTo`, or
   * nothing when the caller asked for no isolation. The in-memory API instead
   * supplies separate private destinations so bundled and declaration output
   * retain their own layout and option validity; both policies are final
   * assignments shared by native emission and independent diagnostic recovery.
   * API callers identify diagnostic-only passes separately so their temporary
   * state does not replace actual emitted state.
   *
   * They null `outFile` and `declarationDir`, pin `outDir`, and explicitly
   * locate incremental state at `.ttsc.tsbuildinfo` inside it. Clearing the
   * state path alone permits inference above outDir for a deep rootDir. A
   * build-info destination does not enable incremental emission; the compiler
   * still owns the incremental/composite decision. Callers append them after
   * the forwarded flags, which applies the final compiler destination
   * assignments after user locations. This is compiler output policy, not an OS
   * sandbox for plugin or cache writes. A `--noEmit` pass needs them as much as
   * an emitting one: the compiler still writes build information for an
   * `incremental` project.
   *
   * @evidence contracts/common.md#principled-implementation The API applies its independently relocated destinations, including explicit private incremental state. Runtime callers clear separate bundle/declaration destinations, pin outDir and explicitly place incremental state within it; choosing a state path does not enable incremental compilation.
   * @evidence contracts/common.md#clear-and-simple-design The runtime directory policy and API destination record share one final argv adapter; direct and native payload composers both append it after forwarded options.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler-supported null option values clear separate destinations instead of intercepting filesystem writes or changing foreign compiler internals.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain affected outputs, final precedence and why no-emit builds still require isolation.
   * @evidence contracts/portability.md#os-neutral-implementation node:path resolves the private target using host-native rules and sends it as one argv value, preserving drive and separator semantics without shell parsing.
   * @evidence contracts/performance.md#efficient-algorithms An API destination record produces at most eight argv tokens. Runtime target resolution includes path-text costs before constructing its fixed eight-token bundle; absent isolation exits without output-token allocation. Fixed token count does not bound target string bytes or native consumer costs.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This returns current isolation options and coordinates no reusable producer or cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Argument construction does not acquire the output directory or manage its lifetime; the private-build owner does.
   */
  export function isolatedTsgoOutputArgs(
    options: RunBuildOptions,
    diagnosticsOnly = false,
  ): string[] {
    const destinations = options.privateOutputDestinations;
    if (destinations !== undefined) {
      const args = [
        "--outDir",
        destinations.outDir ?? "null",
        "--declarationDir",
        destinations.declarationDir ?? "null",
        "--outFile",
        destinations.outFile ?? "null",
      ];
      const state = diagnosticsOnly
        ? (destinations.diagnosticsTsBuildInfoFile ??
          destinations.tsBuildInfoFile)
        : destinations.tsBuildInfoFile;
      if (state !== undefined) args.push("--tsBuildInfoFile", state);
      return args;
    }
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
      path.join(target, ".ttsc.tsbuildinfo"),
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
    // recognized visible boolean timing assignments are removed from this frame.
    return PassthroughFlags.withoutBooleanFlags(passthrough, [
      "--diagnostics",
      "--extendedDiagnostics",
    ]);
  }
}

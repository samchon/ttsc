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
 * except for the sandbox, which comes last because a private build must never
 * write where the user pointed a forwarded output flag.
 */
export namespace TsgoArguments {
  /** Build the argument list for a direct `tsgo` build invocation. */
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
   * - This pass emits, because a no-emit pass has no layout to pin (tsgo skips the
   *   check for `noEmit` too);
   * - The project declares no `rootDir` of its own, so a declared layout is never
   *   overridden.
   *
   * `execution.projectRoot` is the directory of the tsconfig ttsc resolved and
   * hands tsgo as `-p`, which is exactly the directory tsgo infers, and it is
   * spelled the way tsgo will spell the input file names it compares against it —
   * both come from the same `fs.realpathSync` pass. Resolving it any further (a
   * Windows 8.3 expansion, say) would leave the comparison lexically mixed, and
   * `ContainsPath` is lexical: every input would count as outside `rootDir` and
   * tsgo would emit it beside the user's source instead of under `outDir`.
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
   * own diagnostic parser will then see pretty-formatted output and fall back to
   * surfacing it verbatim — the RC-2 contract that `--pretty`'s `internalShadow:
   * true` flag in `FLAG_SCHEMA` declares. Without this guard the order in
   * `runTsgo` (internal flags first, passthrough last) would still let the user's
   * `--pretty true` override at the tsgo level, but ttsc would have already
   * committed to a structured-diagnostics post-process that no longer matches the
   * actual output.
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
   * The payload travels in the `TTSC_TSGO_ARGS` environment variable, not on the
   * sidecar's command line. #113 shipped it as a `--tsgo-args` flag, which is an
   * addition to a plugin protocol third-party hosts had already frozen: a Go
   * `flag.FlagSet` created with `flag.ContinueOnError` treats an undeclared flag
   * as fatal, so every pre-#113 sidecar answered `flag provided but not defined:
   * -tsgo-args` and exited 2. That took down `ttsc --strict`, `ttsc
   * --declaration`, `ttsx --strict` and — because {@link isolatedTsgoOutputArgs}
   * makes this payload non-empty on its own — plain `ttsc <file.ts>`, on every
   * project carrying a typia/nestia-era transform host (issue #1188).
   *
   * The environment is the channel ttsc already uses for host-owned payloads that
   * must not collide with a third-party flag set (`TTSC_LINKED_PLUGINS_JSON`,
   * `TTSC_PLUGIN_CONFIG_DIR`). It reaches those hosts without any change on their
   * side, because `buildSourcePlugin.ts::sourceBuildWorkspaceReplacements` builds
   * every source plugin against the installed ttsc's own driver, and
   * `driver.LoadProgram` reads the variable whenever the caller supplied no
   * explicit argv. It is strictly better than the capability gate `ad3443a` used
   * for `--singleThreaded` / `--checkers`: that one drops the flag for hosts that
   * cannot take it, which is acceptable for a threading knob and not for
   * `--strict`.
   *
   * Returns the JSON payload, or `undefined` when this lane forwards nothing.
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
    const out: string[] = [];
    for (let i = 0; i < passthrough.length; i++) {
      const token = passthrough[i]!;
      if (PassthroughFlags.isDiagnosticsPassthroughFlag(token)) {
        if (
          !token.includes("=") &&
          i + 1 < passthrough.length &&
          PassthroughFlags.isBooleanLiteral(passthrough[i + 1]!)
        ) {
          i++;
        }
        continue;
      }
      out.push(token);
    }
    return out;
  }
}

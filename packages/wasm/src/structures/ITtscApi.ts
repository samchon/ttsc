import type { ITtscBuildOpts } from "./ITtscBuildOpts";
import type { ITtscFileQuery } from "./ITtscFileQuery";
import type { ITtscPluginOpts } from "./ITtscPluginOpts";
import type { ITtscPositionQuery } from "./ITtscPositionQuery";
import type { ITtscResult } from "./ITtscResult";
import type { ITtscSnapshotHandle } from "./ITtscSnapshotHandle";
import type { ITtscVersion } from "./ITtscVersion";

/**
 * API object that every host-built wasm binds to `globalThis[apiName]`.
 *
 * Obtain an instance via `bootTtsc`, which waits for the wasm to signal
 * readiness and returns the typed handle together with its `IMemFSHost`.
 */
export interface ITtscApi {
  /** Build metadata reported by the wasm. Useful for diagnostics. */
  version(): ITtscVersion;

  /**
   * Compile a project: typecheck + emit. `result` is JSON;
   * `parseResult<ITtscCompileResult>` deserializes it.
   */
  build(opts: ITtscBuildOpts): Promise<ITtscResult>;

  /**
   * Typecheck without emit. `result` is JSON; `parseResult<ITtscCompileResult>`
   * deserializes it.
   */
  check(opts: ITtscBuildOpts): Promise<ITtscResult>;

  /**
   * Return every source file the program saw, keyed by project-relative path.
   * Used by playgrounds that want to render the TypeScript view after a source
   * rewriter (e.g. paths) has run. `result` is JSON; use
   * `parseResult<ITtscTransformResult>` to deserialize.
   */
  transform(opts: ITtscBuildOpts): Promise<ITtscResult>;

  /**
   * Dispatch a registered plugin's subcommand. Returns the captured stdout /
   * stderr (the same streams the native sidecar binary would write to) together
   * with the exit code.
   */
  plugin(opts: ITtscPluginOpts): Promise<ITtscResult>;

  /** Names of the plugins this wasm was built with. */
  plugins(): string[];

  /**
   * Load a project once and retain the TypeScript-Go Program in memory for
   * follow-up queries via the other fountain verbs.
   *
   * Callers MUST call `releaseSnapshot` for every handle they receive to free
   * the program's checker pool lease and let Go GC reclaim the AST. Use
   * `parseResult<ITtscSnapshotResult>` to read the handle.
   */
  snapshot(opts: ITtscBuildOpts): Promise<ITtscResult>;

  /**
   * Drop a snapshot held by the wasm. Safe to call with an already-released
   * handle — the response's `released` flag will be `false`.
   */
  releaseSnapshot(opts: ITtscSnapshotHandle): Promise<ITtscResult>;

  /** List the currently retained snapshot handles. Debug aid. */
  snapshots(): Promise<ITtscResult>;

  /** List source file paths held by the snapshot's program. */
  getSourceFiles(opts: ITtscSnapshotHandle): Promise<ITtscResult>;

  /**
   * Read the current text the snapshot's program is holding for a file. After
   * transform-stage plugins ran inside this snapshot, the text reflects their
   * rewrites.
   */
  getSourceFileText(opts: ITtscFileQuery): Promise<ITtscResult>;

  /**
   * Diagnostics from the snapshot's program. Pass `file` to filter to a single
   * project-relative path.
   */
  getDiagnostics(
    opts: ITtscSnapshotHandle & { file?: string },
  ): Promise<ITtscResult>;

  /** Return the deepest AST node whose range covers `position` (byte offset). */
  getNodeAtPosition(opts: ITtscPositionQuery): Promise<ITtscResult>;

  /**
   * Run the TypeScript-Go type checker against the node at `position` and
   * return its printed type string + flags. Returns `{type: null}` when there
   * is no node at that position.
   */
  getTypeAtPosition(opts: ITtscPositionQuery): Promise<ITtscResult>;

  /**
   * Resolve the symbol the node at `position` refers to, including up to 16
   * declaration sites. Returns `{symbol: null}` when no symbol is bound.
   */
  getSymbolAtPosition(opts: ITtscPositionQuery): Promise<ITtscResult>;
}

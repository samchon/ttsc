// Type-safe wrapper around the `globalThis[apiName]` object a host-built wasm
// installs. Every consumer wasm (the base `ttsc.wasm`, the website's
// `playground.wasm`, typia's `ttsc-typia.wasm`) exposes the same surface, so
// one set of types covers them all.

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
}

/** Build metadata embedded in the wasm by the Go linker at compile time. */
export interface ITtscVersion {
  version: string;
  commit: string;
  date: string;
  go: string;
  goos: string;
  goarch: string;
}

/** Options shared by `build`, `check`, and `transform`. */
export interface ITtscBuildOpts {
  /** Absolute virtual path the project lives at inside the MemFS. */
  cwd: string;
  /** Tsconfig path, relative to `cwd`. Defaults to `tsconfig.json`. */
  tsconfig?: string;
}

/** Options for dispatching a named plugin subcommand via `api.plugin`. */
export interface ITtscPluginOpts {
  /** Plugin id registered with `host.Expose` (e.g. `@ttsc/banner`). */
  name: string;
  /** Subcommand the plugin's Run will receive (e.g. `build`). */
  command: string;
  /** Forwarded as `--cwd=<value>`. */
  cwd?: string;
  /** Forwarded as `--tsconfig=<value>`. Defaults to `tsconfig.json`. */
  tsconfig?: string;
  /** Any extra key/value pairs map to `--key=value` argv entries. */
  [key: string]: string | boolean | number | undefined;
}

/** Envelope returned by every `ITtscApi` method. */
export interface ITtscResult {
  /** Exit code. 0 = success, 2 = usage error, 3 = runtime error. */
  code: number;
  /** Anything the wasm wrote to its stdout stream. */
  stdout: string;
  /** Anything the wasm wrote to its stderr stream. */
  stderr: string;
  /**
   * For the base endpoints, the JSON-encoded compile/transform result. For the
   * plugin endpoint, this is empty — the plugin's own output sits in
   * stdout/stderr. Use `parseResult<T>` to deserialize.
   */
  result: string;
}

/**
 * Structured payload inside `ITtscResult.result` for `build` and `check`.
 *
 * `output` maps emit-destination paths (relative to `outDir`) to file contents.
 * It is empty when `check` is called without emit.
 */
export interface ITtscCompileResult {
  diagnostics?: ITtscDiagnostic[];
  output: Record<string, string>;
}

/**
 * Structured payload inside `ITtscResult.result` for `transform`.
 *
 * `typescript` maps source file paths (relative to `cwd`) to their
 * post-transform TypeScript text — useful for playgrounds that want to show the
 * rewritten source before it is emitted.
 */
export interface ITtscTransformResult {
  diagnostics?: ITtscDiagnostic[];
  typescript: Record<string, string>;
}

/**
 * A single TypeScript compiler diagnostic emitted during `build`, `check`, or
 * `transform`. `line` and `character` are 0-based.
 */
export interface ITtscDiagnostic {
  file: string | null;
  category: "error" | "warning";
  code: number;
  start?: number;
  length?: number;
  line?: number;
  character?: number;
  messageText: string;
}

/**
 * Parse the `result` field of an ITtscResult into the structured payload. The
 * wasm returns JSON as a string because js.ValueOf does not handle large nested
 * maps efficiently. Callers JSON.parse exactly once at the boundary.
 */
export function parseResult<T>(result: ITtscResult): T | null {
  if (!result.result) return null;
  try {
    return JSON.parse(result.result) as T;
  } catch {
    return null;
  }
}

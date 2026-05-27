import fs from "node:fs";
import path from "node:path";

import { compileProjectInMemory } from "./compiler/internal/compileProjectInMemory";
import { resolveProjectConfig } from "./compiler/internal/project/resolveProjectConfig";
import { resolveBinary } from "./compiler/internal/resolveBinary";
import { transformProjectInMemory } from "./compiler/internal/transformProjectInMemory";
import { defaultPluginCacheCleanTargets } from "./plugin/internal/buildSourcePlugin";
import { loadProjectPlugins } from "./plugin/internal/loadProjectPlugins";
import type { ITtscCompilerContext } from "./structures/ITtscCompilerContext";
import type { ITtscCompilerDiagnostic } from "./structures/ITtscCompilerDiagnostic";
import type { ITtscCompilerResult } from "./structures/ITtscCompilerResult";
import type { ITtscCompilerTransformation } from "./structures/ITtscCompilerTransformation";
import type { TtscBuildResult } from "./structures/internal/TtscBuildResult";

/**
 * Programmatic compiler host for the `ttsc` TypeScript-Go pipeline.
 *
 * `TtscCompiler` is the root JavaScript API exported by the `ttsc` package. It
 * represents one resolved project context: a working directory, an optional
 * project config path, an optional native toolchain override, an environment, a
 * cache root, and a plugin list. Those values are captured by the constructor
 * and are intentionally not replaceable per method call.
 *
 * The class exposes only the operations that make sense for an embedded
 * compiler host:
 *
 * - {@link TtscCompiler.prepare}: build configured Go source plugins into the
 *   cache before a later compile.
 * - {@link TtscCompiler.clean}: remove the cache owned by this compiler context.
 * - {@link TtscCompiler.compile}: compile the configured project and return a
 *   structured result instead of terminal text.
 * - {@link TtscCompiler.transform}: transform the configured project and return an
 *   embed-style transformation result.
 */
export class TtscCompiler {
  private readonly context: ITtscCompilerContext;

  /**
   * Create a new compiler instance bound to the given project context.
   *
   * The context is defensively copied: mutations to the original object after
   * construction do not affect this instance. Omit `context` (or pass `{}`) to
   * inherit all defaults from the running process.
   */
  public constructor(context: ITtscCompilerContext = {}) {
    this.context = {
      ...context,
      env: context.env ? { ...context.env } : undefined,
      plugins: Array.isArray(context.plugins)
        ? [...context.plugins]
        : context.plugins,
    };
  }

  /**
   * Build every configured source plugin into the instance cache.
   *
   * This method loads the project plugin descriptors, resolves their
   * {@link ITtscPlugin.source} paths, and compiles those Go command packages
   * into the ttsc cache. It is useful when a host application wants to pay the
   * lazy build cost before the first compile call.
   *
   * `prepare()` is not a project check. It does not create a TypeScript-Go
   * Program, does not run diagnostics, and does not emit output files.
   *
   * @returns Compiled native plugin binary paths.
   */
  public prepare(): string[] {
    const execution = this.resolveProjectExecution();
    const loaded = loadProjectPlugins({
      binary: resolveBinary(this.compilerContext()) ?? "",
      cacheDir: this.resolvePluginCacheDir(),
      cwd: execution.cwd,
      entries: this.context.plugins,
      projectRoot: execution.projectRoot,
      tsconfig: execution.tsconfig,
    });
    return loaded.nativePlugins.map((plugin) => plugin.binary);
  }

  /**
   * Remove compiled cache artifacts for this compiler instance.
   *
   * When the constructor received `cacheDir`, this method removes exactly that
   * directory. When `TTSC_CACHE_DIR` is active, it removes that override's
   * plugin cache plus legacy project-local caches. Otherwise it removes the
   * default global plugin cache plus legacy project-local caches.
   *
   * The cache target comes from the constructor context. Create another
   * `TtscCompiler` instance to clean another project or another cache root.
   *
   * @returns Cache directories that were removed.
   */
  public clean(): string[] {
    const cacheDir = this.resolveCacheDir();
    if (cacheDir !== undefined) {
      return removeExistingDirectories([cacheDir]);
    }

    const projectRoot = this.resolveCleanProjectRoot();
    const legacyTargets = [
      path.join(projectRoot, "node_modules", ".ttsc"),
      path.join(projectRoot, ".ttsc"),
    ];
    if (this.context.env?.TTSC_CACHE_DIR) {
      return removeExistingDirectories([
        path.resolve(projectRoot, this.context.env.TTSC_CACHE_DIR, "plugins"),
        ...legacyTargets,
      ]);
    }
    if (process.env.TTSC_CACHE_DIR) {
      return removeExistingDirectories([
        path.resolve(process.env.TTSC_CACHE_DIR, "plugins"),
        ...legacyTargets,
      ]);
    }
    return removeExistingDirectories([
      ...defaultPluginCacheCleanTargets(projectRoot),
    ]);
  }

  /**
   * Compile the configured project.
   *
   * The public API does not write emitted files into the caller's project tree.
   * For projects without plugins, ttsc uses its native TypeScript-Go host's
   * `WriteFile` callback to capture output in memory. For projects with native
   * plugins, ttsc runs the plugin pipeline against a temporary output
   * directory, reads the generated text artifacts, and removes the temporary
   * directory before returning.
   *
   * The result uses an `embed-typescript`-style discriminated union: `success`
   * for clean compiles, `failure` for normal compiler diagnostics, and
   * `exception` for host setup or process failures.
   *
   * @returns Structured compilation result containing diagnostics or output.
   */
  public compile(): ITtscCompilerResult {
    return runProject(() => compileProjectInMemory(this.compilerContext()));
  }

  /**
   * Transform the configured project and return TypeScript text by file path.
   *
   * This is the source-to-source API for plugin authors. It must not return
   * JavaScript emit, declaration files, or source maps; those artifacts belong
   * to {@link TtscCompiler.compile}. A transform native source is expected to
   * write JSON shaped as `{ "typescript": { "src/file.ts": "..." } }` to
   * stdout. When no transform native source is configured, ttsc returns the
   * TypeScript files loaded by the TypeScript-Go Program together with normal
   * diagnostics.
   *
   * The returned shape mirrors `embed-typescript`'s transformation API:
   * `success` and `failure` carry a `typescript` map, while unexpected host
   * errors return `exception`.
   *
   * @returns Transformation result containing TypeScript text or diagnostics.
   */
  public transform(): ITtscCompilerTransformation {
    return runTransformation(() =>
      transformProjectInMemory(this.compilerContext()),
    );
  }

  private compilerContext(): ITtscCompilerContext {
    return {
      ...this.context,
      cacheDir: this.resolveCacheDir(),
    };
  }

  private resolveProjectExecution(): {
    cwd: string;
    projectRoot: string;
    tsconfig: string;
  } {
    const cwd = this.resolveCwd();
    const tsconfig = resolveProjectConfig({
      cwd,
      tsconfig: this.context.tsconfig,
    });
    return {
      cwd,
      projectRoot: this.context.projectRoot
        ? path.resolve(cwd, this.context.projectRoot)
        : path.dirname(tsconfig),
      tsconfig,
    };
  }

  private resolveCleanProjectRoot(): string {
    try {
      return this.resolveProjectExecution().projectRoot;
    } catch (error) {
      if (this.context.tsconfig) {
        throw error;
      }
      return this.resolveCwd();
    }
  }

  private resolveCwd(): string {
    return path.resolve(this.context.cwd ?? process.cwd());
  }

  private resolveCacheDir(): string | undefined {
    if (!this.context.cacheDir) {
      return undefined;
    }
    return path.isAbsolute(this.context.cacheDir)
      ? this.context.cacheDir
      : path.resolve(this.resolveCwd(), this.context.cacheDir);
  }

  private resolvePluginCacheDir(): string | undefined {
    return this.resolveCacheDir() ?? this.context.env?.TTSC_CACHE_DIR;
  }
}

function removeExistingDirectories(directories: readonly string[]): string[] {
  const removed: string[] = [];
  for (const directory of [...new Set(directories)]) {
    if (!fs.existsSync(directory)) {
      continue;
    }
    fs.rmSync(directory, { recursive: true, force: true });
    removed.push(directory);
  }
  return removed;
}

interface ProjectResult {
  output: Record<string, string>;
  result: TtscBuildResult;
}

interface ProjectTransformation {
  result: TtscBuildResult;
  typescript: Record<string, string>;
}

function runProject(task: () => ProjectResult): ITtscCompilerResult {
  try {
    return toCompilerResult(task());
  } catch (error) {
    return {
      error: normalizeError(error),
      kind: classifyException(error),
      type: "exception",
    };
  }
}

function runTransformation(
  task: () => ProjectTransformation,
): ITtscCompilerTransformation {
  try {
    return toCompilerTransformation(task());
  } catch (error) {
    return {
      error: normalizeError(error),
      kind: classifyException(error),
      type: "exception",
    };
  }
}

/**
 * Best-effort classifier for the `kind` field of `IException`. Pattern-
 * matches the real prefixes thrown inside this package:
 *
 *   - Plugin: messages from `loadProjectPlugins.ts` / `buildSourcePlugin.ts`
 *     start with `ttsc: plugin "..."` or `ttsc: package "..." declares ...`,
 *     and transform-time spawn failures start with `ttsc.transform:` /
 *     `ttsc.transform.check:`. The Go-toolchain missing envelope also
 *     surfaces here.
 *   - Host: everything else under the `ttsc:` umbrella — the bare
 *     `ttsc:` strings from `paths.ts`, `ttsc: TypeScript-Go executable
 *     not found` (`resolveTsgo.ts`), `ttsc: failed to spawn native
 *     compiler host` (`transformProjectInMemory.ts`), and tsconfig /
 *     extended-tsconfig shapes from `readProjectConfig.ts`.
 *   - Anything else falls back to `"unknown"` so embedders always see the
 *     field set per the documented contract.
 *
 * Order matters: plugin patterns must run before the generic `ttsc:` test
 * because every plugin message also starts with `ttsc:`.
 */
function classifyException(
  error: unknown,
): "plugin" | "host" | "unknown" {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (
    // Match every plugin-origin shape with verb-anchored patterns so a
    // host-path containing the literal token `plugin` (e.g.
    // `TTSC_BINARY=/opt/cache/plugins/ttsc-bin`) does not misclassify
    // as kind="plugin". Each alternative anchors at the start of the
    // message to capture the verb, not anywhere later in the line:
    //
    //   - `ttsc: plugin "..."` / `ttsc: package "..."` — from
    //     loadProjectPlugins.ts
    //   - `ttsc: building plugin "..."` / `ttsc: reading go.mod for
    //     plugin "..."` — from buildSourcePlugin.ts
    //   - `ttsc.transform:` / `ttsc.transform.check:` — from
    //     transformProjectInMemory.ts
    //   - `ttsc-plugin:` — legacy prefix kept for compatibility
    //   - `go toolchain` — the goToolchainNotFoundMessage envelope
    /^ttsc:\s*plugin\b|^ttsc:\s*package\b|^ttsc:\s*building plugin\b|^ttsc:\s*reading go\.mod for plugin\b|^ttsc\.transform[.:]|^ttsc-plugin:|go toolchain/i.test(
      message,
    )
  ) {
    return "plugin";
  }
  if (
    /^ttsc:|tsconfig|extended tsconfig|TypeScript-Go|native compiler host/i.test(
      message,
    )
  ) {
    return "host";
  }
  return "unknown";
}

function toCompilerResult(project: ProjectResult): ITtscCompilerResult {
  const { output, result } = project;
  if (result.status === 0 && !hasErrorDiagnostics(result.diagnostics)) {
    return {
      ...(result.diagnostics.length === 0
        ? {}
        : { diagnostics: result.diagnostics }),
      output,
      type: "success",
    };
  }
  return {
    diagnostics:
      result.diagnostics.length === 0
        ? [createProcessDiagnostic(result)]
        : result.diagnostics,
    output,
    type: "failure",
  };
}

function createProcessDiagnostic(
  result: TtscBuildResult,
): ITtscCompilerDiagnostic {
  const messageText =
    (result.stderr || result.stdout).trim() ||
    `ttsc exited with status ${result.status}`;
  return {
    category: "error",
    code: "TTSC_PROCESS",
    file: null,
    messageText,
  };
}

function toCompilerTransformation(
  project: ProjectTransformation,
): ITtscCompilerTransformation {
  const { result, typescript } = project;
  if (result.status === 0 && !hasErrorDiagnostics(result.diagnostics)) {
    return {
      ...(result.diagnostics.length === 0
        ? {}
        : { diagnostics: result.diagnostics }),
      type: "success",
      typescript,
    };
  }
  return {
    diagnostics:
      result.diagnostics.length === 0
        ? [createProcessDiagnostic(result)]
        : result.diagnostics,
    type: "failure",
    typescript,
  };
}

function hasErrorDiagnostics(
  diagnostics: readonly ITtscCompilerDiagnostic[],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.category === "error");
}

function normalizeError(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return error;
  }
  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
  };
}

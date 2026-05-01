import * as fs from "node:fs";
import * as path from "node:path";

import { compileProjectInMemory } from "./compiler/internal/compileProjectInMemory";
import { resolveProjectConfig } from "./compiler/internal/project/resolveProjectConfig";
import { resolveBinary } from "./compiler/internal/resolveBinary";
import { loadProjectPlugins } from "./plugin/internal/loadProjectPlugins";
import type { ITtscCompilerContext } from "./structures/ITtscCompilerContext";
import type { ITtscCompilerDiagnostic } from "./structures/ITtscCompilerDiagnostic";
import type { ITtscCompilerResult } from "./structures/ITtscCompilerResult";
import type { TtscBuildResult } from "./structures/internal/TtscBuildResult";

/**
 * Programmatic compiler host for the `ttsc` TypeScript-Go pipeline.
 *
 * `TtscCompiler` is the root JavaScript API exported by the `ttsc` package.
 * It represents one resolved project context: a working directory, an optional
 * project config path, an optional native toolchain override, an environment,
 * a cache root, and a plugin list. Those values are captured by the
 * constructor and are intentionally not replaceable per method call.
 *
 * The class exposes only the operations that make sense for an embedded
 * compiler host:
 *
 * - {@link TtscCompiler.prepare}: build configured Go source plugins into the
 *   cache before a later compile.
 * - {@link TtscCompiler.clean}: remove the cache owned by this compiler
 *   context.
 * - {@link TtscCompiler.compile}: compile the configured project and return a
 *   structured result instead of terminal text.
 */
export class TtscCompiler {
  private readonly context: ITtscCompilerContext;

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
      tsconfig: execution.tsconfig,
    });
    return loaded.nativePlugins.map((plugin) => plugin.binary);
  }

  /**
   * Remove compiled cache artifacts for this compiler instance.
   *
   * When the constructor received `cacheDir`, this method removes exactly that
   * directory. Otherwise it removes the default ttsc cache locations for the
   * resolved project root, plus the `TTSC_CACHE_DIR/plugins` cache when that
   * environment variable is active.
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

    const envCacheDir =
      this.context.env?.TTSC_CACHE_DIR ?? process.env.TTSC_CACHE_DIR;
    const projectRoot = this.resolveCleanProjectRoot();
    return removeExistingDirectories([
      ...(envCacheDir ? [path.resolve(envCacheDir, "plugins")] : []),
      path.join(projectRoot, "node_modules", ".ttsc"),
      path.join(projectRoot, ".ttsc"),
    ]);
  }

  /**
   * Compile the configured project.
   *
   * The public API does not write emitted files into the caller's project tree.
   * For projects without plugins, ttsc uses its native TypeScript-Go host's
   * `WriteFile` callback to capture output in memory. For projects with
   * native plugins, ttsc runs the plugin pipeline against a temporary output
   * directory, reads the generated text artifacts, and removes the temporary
   * directory before returning.
   *
   * The result uses an `embed-typescript`-style discriminated union:
   * `success` for clean compiles, `failure` for normal compiler diagnostics,
   * and `exception` for host setup or process failures.
   *
   * @returns Structured compilation result containing diagnostics or output.
   */
  public compile(): ITtscCompilerResult {
    return runProject(() => compileProjectInMemory(this.compilerContext()));
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
      projectRoot: path.dirname(tsconfig),
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

function runProject(task: () => ProjectResult): ITtscCompilerResult {
  try {
    return toCompilerResult(task());
  } catch (error) {
    return {
      error: normalizeError(error),
      type: "exception",
    };
  }
}

function toCompilerResult(project: ProjectResult): ITtscCompilerResult {
  const { output, result } = project;
  if (result.status === 0 && result.diagnostics.length === 0) {
    return {
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

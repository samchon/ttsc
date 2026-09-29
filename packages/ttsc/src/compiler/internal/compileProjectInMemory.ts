import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import { hasProjectPluginEntries } from "../../plugin/internal/load/hasProjectPluginEntries";
import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import { runBuild } from "./build/runBuild";
import { buildNativeCompiler } from "./buildNativeCompiler";
import { isOutsideRelativePath } from "./isOutsideRelativePath";
import { outputText } from "./outputText";
import { packageRootDir } from "./packageRootDir";
import { readProjectConfig } from "./project/readProjectConfig";
import { SidecarEnvironment } from "./sharedHost/SidecarEnvironment";
import { inheritedSidecarEnv } from "./sharedHost/inheritedSidecarEnv";
import { spawnNative } from "./spawnNative";

/**
 * Compile a project and capture emitted files without writing to the project
 * tree.
 *
 * When no plugins are configured the fast path spawns the native ttsc compiler
 * host (`cmd/ttsc api-compile`) which returns a structured JSON response
 * containing diagnostics and an output file map. When plugins are present the
 * slow path goes through `runBuild` into a temp directory and reads the files
 * back from disk.
 *
 * A native response must contain a string-valued output record. Plugin output
 * storage is removed before returning. If removal also fails after a thrown
 * operation failure, both are retained in an AggregateError with the original
 * cause. An unsuccessful returned build retains its diagnostics and partial
 * output in that aggregate; removal failure after success propagates directly.
 *
 * @returns A map of output path → file content plus a `TtscBuildResult` with
 *   diagnostics and the exit status.
 *
 * @evidence contracts/common.md#principled-implementation The plugin-free API host supplies a required text-output record and structured diagnostics; plugin projects use the existing build owner and read its isolated emitted files with the project's output-key convention.
 * @evidence contracts/common.md#clear-and-simple-design One router separates structured native capture from plugin-backed disk emission while project discovery, native execution and build semantics remain with their owning helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin discovery failure routes through the build's real diagnostic path, and an absent or malformed native output record cannot become an empty successful compile.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe both compile lanes and output-key ownership; separated return members explain diagnostics/status versus emitted content under documentation guidance.
 * @evidence contracts/performance.md#efficient-algorithms The native lane captures output once; the plugin lane visits E directory entries, sorts F file paths once in O(F log F) and reads each emitted file once, with compiler work and emitted bytes dominating processing.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each compile observes potentially changed source and plugin effects; this API owns no proven equivalent-generation cache. The native binary builder independently reuses its valid artifact.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Native capture is disposed by spawnNative; plugin emission owns one temporary tree through finally removal. Cleanup failure propagates after success and aggregates with a thrown failure or a build outcome carrying nonzero status or error diagnostics, preserving its diagnostics and partial output rather than masking it.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths use Node resolution and argument arrays; inheritedSidecarEnv owns child environment spelling and pathToKey converts only host separators in returned protocol keys, preserving literal POSIX backslashes.
 */
export function compileProjectInMemory(options: ITtscCompilerContext): {
  /** Emitted content under the project's native API output-key convention. */
  output: Record<string, string>;

  /** Compiler diagnostics, exit status and textual failure context. */
  result: TtscBuildResult;
} {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const project = readProjectConfig({
    cwd,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  if (shouldUsePluginBuild(options, project)) {
    return compileProjectWithPlugins(options, cwd, project);
  }
  const tsconfig = project.path;
  const binary = buildNativeCompiler({
    cacheBaseDir: project.root,
    cacheDir:
      options.cacheDir ??
      SidecarEnvironment.read(options.env, "TTSC_CACHE_DIR"),
    packageRoot: packageRootDir(),
  });
  const res = spawnNative(
    binary,
    ["api-compile", "--cwd", project.root, "--tsconfig", tsconfig],
    {
      cwd: project.root,
      env: inheritedSidecarEnv(options.env, options.binary),
    },
  );
  if (res.error) {
    throw new Error(
      `ttsc: failed to spawn native compiler host ${binary}: ${res.error.message}`,
    );
  }

  const output = parseNativeCompileOutput(
    outputText(res.stdout),
    outputText(res.stderr),
  );
  return {
    output: output.output,
    result: {
      diagnostics: output.diagnostics,
      emittedSources: output.emittedSources,
      status: res.status ?? 1,
      stdout: "",
      stderr: outputText(res.stderr),
    },
  };
}

/** Return true when the project or the call-level options declare any plugins. */
function hasConfiguredPlugins(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
): boolean {
  return hasProjectPluginEntries(project, options.plugins);
}

/**
 * Route plugin discovery failures through runBuild's recoverable setup path.
 * The fast native-host lane cannot surface the plugin error or run the
 * post-failure TypeScript check, while the plugin-backed lane can do both.
 */
function shouldUsePluginBuild(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
): boolean {
  try {
    return hasConfiguredPlugins(options, project);
  } catch {
    return true;
  }
}

/**
 * Plugin-backed compilation: emit into a temp directory via `runBuild`, then
 * read back every file the build wrote so they can be returned as strings.
 */
function compileProjectWithPlugins(
  options: ITtscCompilerContext,
  cwd: string,
  project: ITtscParsedProjectConfig,
): {
  /** Emitted content under the same project-relative keys as the native API. */
  output: Record<string, string>;

  /** Compiler diagnostics, process status and textual failure context. */
  result: TtscBuildResult;
} {
  const tempRoot = createCanonicalTempDirectory("ttsc-api-output-");
  const tempOutDir = path.join(tempRoot, "out");
  let outcome: ReturnType<typeof compileProjectInMemory> | undefined;
  let failed = false;
  let failure: unknown;
  try {
    const result = runBuild({
      ...options,
      cwd,
      emit: true,
      forceListEmittedFiles: true,
      outDir: tempOutDir,
      // The temp directory is an `outDir` this lane injected so the emit can be
      // read back as strings; the project need not declare one at all. tsgo
      // answers an inferred common source directory with TS5011 as soon as any
      // `outDir` is in play, so pin the root it would infer. The keys
      // `outputKeyMapper` builds are unchanged by it — that root is exactly the
      // layout tsgo already lays the emit out against (issue #1172).
      pinInferredRootDir: true,
      quiet: true,
      resolvedProject: project,
      structuredDiagnostics: true,
      tsconfig: project.path,
    });
    outcome = {
      output: readOutputDirectory(tempOutDir, outputKeyMapper(project)),
      result,
    };
    return outcome;
  } catch (error) {
    failed = true;
    failure = error;
    throw error;
  } finally {
    try {
      fs.rmSync(tempRoot, { force: true, recursive: true });
    } catch (cleanupError) {
      if (failed) {
        throw new AggregateError(
          [failure, cleanupError],
          "ttsc: project compilation and temporary output cleanup failed",
          { cause: failure },
        );
      }
      if (
        outcome !== undefined &&
        (outcome.result.status !== 0 ||
          outcome.result.diagnostics.some(
            (diagnostic) => diagnostic.category === "error",
          ))
      ) {
        throw new AggregateError(
          [outcome, cleanupError],
          "ttsc: unsuccessful project compilation and temporary output cleanup failed",
          { cause: outcome },
        );
      }
      throw cleanupError;
    }
  }
}

/**
 * Build a function that maps a path relative to the temp output directory to
 * the key used in the returned `output` map.
 *
 * When `outDir` is inside the project root the key is relative to the project
 * root (preserving the `outDir` prefix). When `outDir` is outside the project
 * root the key is absolute-style (`/absolute/outDir/relative`). When `outDir`
 * is absent the key is the bare relative path.
 */
function outputKeyMapper(
  project: ITtscParsedProjectConfig,
): (relativePath: string) => string {
  const outDir = project.compilerOptions.outDir;
  if (!outDir) {
    return (relativePath) => relativePath;
  }
  const relativeOutDir = path.relative(project.root, outDir);
  if (relativeOutDir !== "" && !isOutsideRelativePath(relativeOutDir)) {
    const prefix = pathToKey(relativeOutDir);
    return (relativePath) => path.posix.join(prefix, relativePath);
  }
  return (relativePath) => pathToKey(path.join(outDir, relativePath));
}

/** Read every file in `directory` recursively and return a `path→content` map. */
function readOutputDirectory(
  directory: string,
  keyOf: (relativePath: string) => string,
): Record<string, string> {
  const output: Record<string, string> = {};
  if (!fs.existsSync(directory)) {
    return output;
  }
  for (const file of listFiles(directory)) {
    output[keyOf(pathToKey(path.relative(directory, file)))] = fs.readFileSync(
      file,
      "utf8",
    );
  }
  return output;
}

/** Recursively list all files under `directory`, sorted for stable output. */
function listFiles(directory: string): string[] {
  const out: string[] = [];
  const pending = [directory];
  while (pending.length !== 0) {
    const current = pending.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const location = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(location);
      } else if (entry.isFile()) {
        out.push(location);
      }
    }
  }
  return out.sort();
}

/**
 * Convert native separators, while retaining literal POSIX backslashes, for
 * output keys.
 */
function pathToKey(file: string): string {
  return file.replaceAll(path.sep, "/");
}

/**
 * Parse the JSON envelope written by the native compiler host to stdout.
 *
 * On success returns diagnostics, output and optional emitted-source
 * provenance. Missing legacy provenance remains unknown. Malformed provenance
 * is rejected. On JSON parse failure throws a descriptive error using stderr
 * (preferred) or stdout as context, so callers see the original compiler error
 * rather than a generic JSON parse message.
 */
function parseNativeCompileOutput(
  stdout: string,
  stderr: string,
): {
  diagnostics: ITtscCompilerDiagnostic[];
  output: Record<string, string>;
  emittedSources?: Record<string, readonly string[]>;
} {
  try {
    const parsed = JSON.parse(stdout) as {
      diagnostics?: ITtscCompilerDiagnostic[];
      output?: Record<string, string>;
      emittedSources?: Record<string, readonly string[]>;
    };
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      typeof parsed.output !== "object" ||
      parsed.output === null ||
      Array.isArray(parsed.output) ||
      !Object.values(parsed.output).every((value) => typeof value === "string")
    ) {
      throw new Error(
        "ttsc: native compiler host returned an invalid output map",
      );
    }
    if (
      parsed.emittedSources !== undefined &&
      (typeof parsed.emittedSources !== "object" ||
        parsed.emittedSources === null ||
        Array.isArray(parsed.emittedSources) ||
        !Object.entries(parsed.emittedSources).every(
          ([output, sources]) =>
            path.isAbsolute(output) &&
            Array.isArray(sources) &&
            sources.every(
              (source) => typeof source === "string" && path.isAbsolute(source),
            ),
        ))
    ) {
      throw new Error(
        "ttsc: native compiler host returned invalid emit provenance",
      );
    }
    return {
      diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [],
      output: parsed.output,
      emittedSources: parsed.emittedSources,
    };
  } catch (error) {
    if (error instanceof Error && !(error instanceof SyntaxError)) {
      throw error;
    }
    throw new Error(
      (stderr || stdout).trim() ||
        "ttsc: native compiler host returned no output",
    );
  }
}

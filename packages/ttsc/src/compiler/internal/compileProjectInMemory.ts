import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import { hasProjectPluginEntries } from "../../plugin/internal/load/hasProjectPluginEntries";
import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import { PrivateCompilerOutput } from "./PrivateCompilerOutput";
import { runBuild } from "./build/runBuild";
import { buildNativeCompiler } from "./buildNativeCompiler";
import { outputText } from "./outputText";
import { packageRootDir } from "./packageRootDir";
import { readProjectConfig } from "./project/readProjectConfig";
import { SidecarEnvironment } from "./sharedHost/SidecarEnvironment";
import { inheritedSidecarEnv } from "./sharedHost/inheritedSidecarEnv";
import { spawnNative } from "./spawnNative";

/**
 * Compile a project while capturing emitted outputs instead of placing those
 * outputs in the project tree. Compiler/plugin caches and plugin side effects
 * remain owned by their normal paths; this is not a no-filesystem-write mode.
 *
 * When no plugins are configured the native path spawns the native ttsc
 * compiler host (`cmd/ttsc api-compile`) which returns a structured JSON
 * response containing diagnostics and an output file map. When plugins are
 * present the plugin path goes through `runBuild` into a temp directory and
 * reads the files back from disk. Independent recovery checks use the same
 * private destinations, with a separate incremental-state file that is not an
 * emitted API artifact. Actual emission state remains in returned partial
 * output.
 *
 * A native response must contain a string-valued output record. Plugin output
 * storage removal is attempted before returning. If removal also fails after a
 * thrown operation failure, both are retained in an AggregateError with the
 * original cause. An unsuccessful returned build retains its diagnostics and
 * partial output in that aggregate; removal failure after success propagates
 * directly.
 *
 * @returns A map of output path → file content plus a `TtscBuildResult` with
 *   diagnostics and the exit status.
 * @evidence contracts/common.md#principled-implementation The plugin-free API host supplies a required text-output record and structured diagnostics; plugin projects use the existing build owner and read its isolated emitted files with the project's output-key convention, translating private map/state coordinates back to their original artifact locations.
 * @evidence contracts/common.md#clear-and-simple-design One router separates structured native capture from plugin-backed disk emission while project discovery, native execution and build semantics remain with their owning helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Plugin discovery failure routes through the build's real diagnostic path, and an absent or malformed native output record cannot become an empty successful compile.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe both compile lanes and output-key ownership; separated return members explain diagnostics/status versus emitted content under documentation guidance.
 * @evidence contracts/performance.md#efficient-algorithms Project discovery/plugin admission and native-host source/cache construction are delegated costs of this call. The native lane captures, decodes and parses complete JSON output; the plugin lane visits E entries, sorts F paths with path-text comparison costs and reads emitted bytes once. Native I/O, compiler work, output-key text and temporary storage grow with their actual inputs; no measured lane speed ranking is claimed.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each compile observes potentially changed source and plugin effects; this API owns no proven equivalent-generation cache. The native binary builder independently reuses its valid artifact.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Native capture cleanup is best effort in spawnNative; plugin emission owns one accepted temporary tree through finally removal, while temp acquisition has its own failure limitations. Cleanup failure propagates after success and aggregates with a thrown failure or a build outcome carrying nonzero status or error diagnostics, preserving its diagnostics and partial output rather than masking it.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths use Node resolution and argument arrays; inheritedSidecarEnv owns child environment spelling and the private output owner preserves native output destinations and protocol key spelling, including literal POSIX backslashes.
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
  let outcome: ReturnType<typeof compileProjectInMemory> | undefined;
  let failed = false;
  let failure: unknown;
  try {
    const layout = PrivateCompilerOutput.create(project, tempRoot);
    const result = runBuild({
      ...options,
      cwd,
      emit: true,
      forceListEmittedFiles: true,
      outDir: layout.destinations.outDir ?? undefined,
      privateOutputDestinations: layout.destinations,
      // Private output adds an outDir to source-adjacent projects. Pin only
      // their layout root; configured roots and bundle-only layouts retain
      // the compiler's containment and option validity.
      pinInferredRootDir: layout.pinInferredRootDir,
      quiet: true,
      resolvedProject: project,
      structuredDiagnostics: true,
      tsconfig: project.path,
    });
    outcome = {
      output: PrivateCompilerOutput.read(
        project,
        tempRoot,
        layout.originalPath,
        layout.destinations.tsBuildInfoFile,
        layout.destinations.diagnosticsTsBuildInfoFile,
      ),
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

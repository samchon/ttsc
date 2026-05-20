import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { hasProjectPluginEntries } from "../../plugin/internal/loadProjectPlugins";
import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import { buildNativeCompiler } from "./buildNativeCompiler";
import { isOutsideRelativePath, packageRootDir } from "./paths";
import { readProjectConfig } from "./project/readProjectConfig";
import { runBuild } from "./runBuild";

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
 * @returns A map of output path → file content plus a `TtscBuildResult` with
 *   diagnostics and the exit status.
 */
export function compileProjectInMemory(options: ITtscCompilerContext): {
  output: Record<string, string>;
  result: TtscBuildResult;
} {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const project = readProjectConfig({
    cwd,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  if (hasConfiguredPlugins(options, project)) {
    return compileProjectWithPlugins(options, cwd, project);
  }
  const tsconfig = project.path;
  const binary = buildNativeCompiler({
    cacheBaseDir: project.root,
    cacheDir: options.cacheDir ?? options.env?.TTSC_CACHE_DIR,
    packageRoot: packageRootDir(),
  });
  const res = spawnSync(
    binary,
    ["api-compile", "--cwd", project.root, "--tsconfig", tsconfig],
    {
      cwd: project.root,
      encoding: "utf8",
      env: { ...process.env, ...options.env },
      maxBuffer: 1024 * 1024 * 256,
      windowsHide: true,
    },
  );
  if (res.error) {
    throw new Error(
      `ttsc: failed to spawn native compiler host ${binary}: ${res.error.message}`,
    );
  }

  const output = parseNativeCompileOutput(res.stdout, res.stderr);
  return {
    output: output.output,
    result: {
      diagnostics: output.diagnostics,
      status: res.status ?? 1,
      stdout: "",
      stderr: res.stderr,
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
 * Plugin-backed compilation: emit into a temp directory via `runBuild`, then
 * read back every file the build wrote so they can be returned as strings.
 */
function compileProjectWithPlugins(
  options: ITtscCompilerContext,
  cwd: string,
  project: ITtscParsedProjectConfig,
): {
  output: Record<string, string>;
  result: TtscBuildResult;
} {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-api-output-"));
  const tempOutDir = path.join(tempRoot, "out");
  try {
    const result = runBuild({
      ...options,
      cwd,
      emit: true,
      forceListEmittedFiles: true,
      outDir: tempOutDir,
      quiet: true,
      structuredDiagnostics: true,
      tsconfig: project.path,
    });
    return {
      output: readOutputDirectory(tempOutDir, outputKeyMapper(project)),
      result,
    };
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
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
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(location));
    } else if (entry.isFile()) {
      out.push(location);
    }
  }
  return out.sort();
}

/** Normalise a file path to a forward-slash key suitable for the output map. */
function pathToKey(file: string): string {
  return file.replace(/\\/g, "/");
}

/**
 * Parse the JSON envelope written by the native compiler host to stdout.
 *
 * On success returns `{ diagnostics, output }`. On JSON parse failure throws a
 * descriptive error using stderr (preferred) or stdout as context, so callers
 * see the original compiler error rather than a generic JSON parse message.
 */
function parseNativeCompileOutput(
  stdout: string,
  stderr: string,
): {
  diagnostics: ITtscCompilerDiagnostic[];
  output: Record<string, string>;
} {
  try {
    const parsed = JSON.parse(stdout) as {
      diagnostics?: ITtscCompilerDiagnostic[];
      output?: Record<string, string>;
    };
    return {
      diagnostics: parsed.diagnostics ?? [],
      output: parsed.output ?? {},
    };
  } catch {
    throw new Error(
      (stderr || stdout).trim() ||
        "ttsc: native compiler host returned no output",
    );
  }
}

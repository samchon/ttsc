import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscProjectPluginConfig } from "../../structures/ITtscProjectPluginConfig";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import { buildNativeCompiler } from "./buildNativeCompiler";
import { readProjectConfig } from "./project/readProjectConfig";
import { runBuild } from "./runBuild";

/** Compile a project and capture emitted files without writing to the project tree. */
export function compileProjectInMemory(options: ITtscCompilerContext): {
  output: Record<string, string>;
  result: TtscBuildResult;
} {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const project = readProjectConfig({
    cwd,
    tsconfig: options.tsconfig,
  });
  if (configuredPlugins(options, project).length !== 0) {
    return compileProjectWithPlugins(options, cwd, project);
  }
  const tsconfig = project.path;
  const binary = buildNativeCompiler({
    cacheBaseDir: path.dirname(tsconfig),
    cacheDir: options.cacheDir,
    packageRoot: packageRootDir(),
  });
  const res = spawnSync(
    binary,
    ["api-compile", "--cwd", path.dirname(tsconfig), "--tsconfig", tsconfig],
    {
      cwd: path.dirname(tsconfig),
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

function configuredPlugins(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
): ITtscProjectPluginConfig[] {
  if (options.plugins === false) {
    return [];
  }
  const entries = options.plugins ?? project.compilerOptions.plugins;
  return entries.filter((entry) => entry.enabled !== false);
}

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

function outputKeyMapper(
  project: ITtscParsedProjectConfig,
): (relativePath: string) => string {
  const outDir = project.compilerOptions.outDir;
  if (!outDir) {
    return (relativePath) => relativePath;
  }
  const relativeOutDir = path.relative(project.root, outDir);
  if (relativeOutDir !== "" && !relativeOutDir.startsWith("..")) {
    const prefix = pathToKey(relativeOutDir);
    return (relativePath) => path.posix.join(prefix, relativePath);
  }
  return (relativePath) => pathToKey(path.join(outDir, relativePath));
}

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

function pathToKey(file: string): string {
  return file.replace(/\\/g, "/");
}

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

function packageRootDir(): string {
  let current = path.resolve(__dirname);
  while (true) {
    if (
      fs.existsSync(path.join(current, "package.json")) &&
      fs.existsSync(path.join(current, "go.mod"))
    ) {
      return fs.realpathSync.native?.(current) ?? fs.realpathSync(current);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("ttsc: package root not found for native compiler build");
    }
    current = parent;
  }
}

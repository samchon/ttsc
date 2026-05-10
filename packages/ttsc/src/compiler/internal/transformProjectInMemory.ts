import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  hasProjectPluginEntries,
  loadProjectPlugins,
} from "../../plugin/internal/loadProjectPlugins";
import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import { buildNativeCompiler } from "./buildNativeCompiler";
import { readProjectConfig } from "./project/readProjectConfig";
import { resolveBinary } from "./resolveBinary";
import { resolveTsgo } from "./resolveTsgo";
import { appendBuildOutput, normalizeBuildOutput } from "./runBuild";

/** Transform a project and capture TypeScript source output in memory. */
export function transformProjectInMemory(options: ITtscCompilerContext): {
  result: TtscBuildResult;
  typescript: Record<string, string>;
} {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const project = readProjectConfig({
    cwd,
    projectRoot: options.projectRoot,
    tsconfig: options.tsconfig,
  });
  if (hasConfiguredPlugins(options, project)) {
    return transformProjectWithPlugins(options, cwd, project);
  }
  return transformProjectWithNativeHost(options, project);
}

function hasConfiguredPlugins(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
): boolean {
  return hasProjectPluginEntries(project, options.plugins);
}

function transformProjectWithNativeHost(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
): {
  result: TtscBuildResult;
  typescript: Record<string, string>;
} {
  const binary = buildNativeCompiler({
    cacheBaseDir: project.root,
    cacheDir: options.cacheDir ?? options.env?.TTSC_CACHE_DIR,
    packageRoot: packageRootDir(),
  });
  const res = spawnNative(
    binary,
    ["api-transform", "--cwd", project.root, "--tsconfig", project.path],
    {
      cwd: project.root,
      env: { ...process.env, ...options.env },
    },
  );
  if (res.error) {
    throw new Error(
      `ttsc: failed to spawn native compiler host ${binary}: ${res.error.message}`,
    );
  }

  const output = parseNativeTransformOutput(
    outputText(res.stdout),
    outputText(res.stderr),
  );
  return {
    result: {
      diagnostics: output.diagnostics,
      status: res.status ?? 1,
      stdout: "",
      stderr: outputText(res.stderr),
    },
    typescript: output.typescript,
  };
}

function transformProjectWithPlugins(
  options: ITtscCompilerContext,
  cwd: string,
  project: ITtscParsedProjectConfig,
): {
  result: TtscBuildResult;
  typescript: Record<string, string>;
} {
  const loaded = loadProjectPlugins({
    binary: resolveBinary(options) ?? "",
    cacheDir: options.cacheDir ?? options.env?.TTSC_CACHE_DIR,
    cwd,
    entries: options.plugins,
    projectRoot: options.projectRoot,
    tsconfig: project.path,
  });
  const checks = loaded.nativePlugins.filter(
    (plugin) => plugin.stage === "check",
  );
  const transformers = loaded.nativePlugins.filter(
    (plugin) => plugin.stage === "transform",
  );
  const checked = runNativeChecks(
    options,
    project,
    loaded.nativePlugins,
    checks,
  );
  if (checked.status !== 0) {
    return {
      result: checked,
      typescript: {},
    };
  }
  if (transformers.length === 0) {
    const transformed = transformProjectWithNativeHost(options, project);
    return {
      result: appendBuildOutput(checked, transformed.result),
      typescript: transformed.typescript,
    };
  }
  assertTransformHostCompatibility(transformers);

  const plugin = transformers[0]!;
  const res = spawnNative(
    plugin.binary,
    createNativeTransformArgs(project, transformers),
    {
      cwd: project.root,
      env: nativePluginEnv(options, project.root),
    },
  );
  if (res.error) {
    throw new Error(
      `ttsc.transform: failed to spawn ${plugin.binary}: ${res.error.message}`,
    );
  }
  const output = parseNativeTransformOutput(
    outputText(res.stdout),
    outputText(res.stderr),
  );
  const result = {
    diagnostics: output.diagnostics,
    status: res.status ?? 1,
    stdout: "",
    stderr: outputText(res.stderr),
  };
  return {
    result: appendBuildOutput(checked, result),
    typescript: output.typescript,
  };
}

function runNativeChecks(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
  nativePlugins: readonly ITtscLoadedNativePlugin[],
  checks: readonly ITtscLoadedNativePlugin[],
): TtscBuildResult {
  let result: TtscBuildResult = {
    diagnostics: [],
    status: 0,
    stdout: "",
    stderr: "",
  };
  for (const plugin of checks) {
    const res = spawnNative(
      plugin.binary,
      createNativeCheckArgs(project, nativePlugins),
      {
        cwd: project.root,
        env: nativePluginEnv(options, project.root),
      },
    );
    if (res.error) {
      throw new Error(
        `ttsc.transform.check: failed to spawn ${plugin.binary}: ${res.error.message}`,
      );
    }
    result = appendBuildOutput(
      result,
      normalizeBuildOutput(
        {
          status: res.status ?? 1,
          stdout: outputText(res.stdout),
          stderr: outputText(res.stderr),
        },
        project.root,
      ),
    );
    if (result.status !== 0) {
      return result;
    }
  }
  return result;
}

function createNativeTransformArgs(
  project: ITtscParsedProjectConfig,
  plugins: readonly ITtscLoadedNativePlugin[],
): string[] {
  return [
    "transform",
    "--tsconfig=" + project.path,
    "--plugins-json=" + serializeNativePlugins(plugins),
    "--cwd=" + project.root,
  ];
}

function createNativeCheckArgs(
  project: ITtscParsedProjectConfig,
  plugins: readonly ITtscLoadedNativePlugin[],
): string[] {
  return [
    "check",
    "--tsconfig=" + project.path,
    "--plugins-json=" + serializeNativePlugins(plugins),
    "--cwd=" + project.root,
  ];
}

function serializeNativePlugins(
  plugins: readonly ITtscLoadedNativePlugin[],
): string {
  return JSON.stringify(
    plugins.map((plugin) => ({
      config: plugin.config,
      name: plugin.name,
      stage: plugin.stage,
    })),
  );
}

function assertTransformHostCompatibility(
  plugins: readonly ITtscLoadedNativePlugin[],
): void {
  const binaries = [...new Set(plugins.map((plugin) => plugin.binary))];
  if (binaries.length <= 1) {
    return;
  }
  if (plugins.every(isFirstPartyUtilityTransformPlugin)) {
    return;
  }
  throw new Error(
    "ttsc: multiple transform native backends cannot share one source-to-source pass; " +
      "compose transform libraries through one aggregate native host",
  );
}

function isFirstPartyUtilityTransformPlugin(
  plugin: ITtscLoadedNativePlugin,
): boolean {
  if (plugin.stage !== "transform") return false;
  if (!firstPartyUtilityPluginNames.has(plugin.name)) return false;
  const manifest = readNearestPackageManifest(plugin.source);
  return manifest?.name === plugin.name;
}

const firstPartyUtilityPluginNames = new Set([
  "@ttsc/banner",
  "@ttsc/paths",
  "@ttsc/strip",
]);

function readNearestPackageManifest(
  source: string,
): { name?: unknown } | undefined {
  try {
    let current = fs.statSync(source).isDirectory()
      ? source
      : path.dirname(source);
    for (let i = 0; i < 4; i += 1) {
      const manifest = path.join(current, "package.json");
      if (fs.existsSync(manifest)) {
        return JSON.parse(fs.readFileSync(manifest, "utf8")) as {
          name?: unknown;
        };
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function nativePluginEnv(
  options: ITtscCompilerContext,
  projectRoot: string,
): NodeJS.ProcessEnv {
  const tsgo = resolveTsgo({ ...options, cwd: projectRoot });
  return {
    ...process.env,
    TTSC_NODE_BINARY: process.env.TTSC_NODE_BINARY ?? process.execPath,
    TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? tsgo.binary,
    TTSC_TTSX_BINARY:
      process.env.TTSC_TTSX_BINARY ??
      path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
    ...options.env,
  };
}

function spawnNative(
  binary: string,
  args: readonly string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  },
) {
  const viaNode = /\.(?:[cm]?js|ts)$/i.test(binary);
  if (!viaNode) {
    ensureExecutable(binary);
  }
  return spawnSync(
    viaNode ? process.execPath : binary,
    viaNode ? [binary, ...args] : [...args],
    {
      cwd: options.cwd,
      encoding: "utf8",
      env: options.env,
      maxBuffer: 1024 * 1024 * 256,
      windowsHide: true,
    },
  );
}

function ensureExecutable(binary: string): void {
  if (process.platform === "win32") {
    return;
  }
  try {
    const mode = fs.statSync(binary).mode & 0o777;
    if ((mode & 0o111) !== 0) {
      return;
    }
    fs.chmodSync(binary, mode | 0o755);
  } catch {
    /* keep the original spawn error path */
  }
}

function outputText(value: string | Buffer | null | undefined): string {
  if (value == null) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}

function parseNativeTransformOutput(
  stdout: string,
  stderr: string,
): {
  diagnostics: ITtscCompilerDiagnostic[];
  typescript: Record<string, string>;
} {
  try {
    const parsed = JSON.parse(stdout) as {
      diagnostics?: ITtscCompilerDiagnostic[];
      typescript?: Record<string, string>;
    };
    if (!isTextRecord(parsed.typescript)) {
      throw new Error(
        "ttsc: native transform host did not return a TypeScript source map",
      );
    }
    return {
      diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [],
      typescript: parsed.typescript,
    };
  } catch (error) {
    if (error instanceof Error && !(error instanceof SyntaxError)) {
      throw error;
    }
    throw new Error(
      (stderr || stdout).trim() ||
        "ttsc: native transform host returned no output",
    );
  }
}

function isTextRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
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

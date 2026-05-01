import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { loadProjectPlugins } from "../../plugin/internal/loadProjectPlugins";
import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscProjectPluginConfig } from "../../structures/ITtscProjectPluginConfig";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import { buildNativeCompiler } from "./buildNativeCompiler";
import { readProjectConfig } from "./project/readProjectConfig";
import { resolveBinary } from "./resolveBinary";
import { resolveTsgo } from "./resolveTsgo";

/** Transform a project and capture TypeScript source output in memory. */
export function transformProjectInMemory(options: ITtscCompilerContext): {
  result: TtscBuildResult;
  typescript: Record<string, string>;
} {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const project = readProjectConfig({
    cwd,
    tsconfig: options.tsconfig,
  });
  if (configuredPlugins(options, project).length !== 0) {
    return transformProjectWithPlugins(options, cwd, project);
  }
  return transformProjectWithNativeHost(options, project);
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

function transformProjectWithNativeHost(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
): {
  result: TtscBuildResult;
  typescript: Record<string, string>;
} {
  const binary = buildNativeCompiler({
    cacheBaseDir: project.root,
    cacheDir: options.cacheDir,
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
    return transformProjectWithNativeHost(options, project);
  }
  assertSingleTransformHost(transformers);

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
    result = appendBuildResult(result, {
      diagnostics: [],
      status: res.status ?? 1,
      stdout: outputText(res.stdout),
      stderr: outputText(res.stderr),
    });
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

function assertSingleTransformHost(
  plugins: readonly ITtscLoadedNativePlugin[],
): void {
  const binaries = [...new Set(plugins.map((plugin) => plugin.binary))];
  if (binaries.length > 1) {
    throw new Error(
      "ttsc: multiple transform native backends cannot share one source-to-source pass",
    );
  }
}

function appendBuildResult(
  left: TtscBuildResult,
  right: TtscBuildResult,
): TtscBuildResult {
  return {
    diagnostics: [...left.diagnostics, ...right.diagnostics],
    status: right.status !== 0 ? right.status : left.status,
    stdout: left.stdout + right.stdout,
    stderr: left.stderr + right.stderr,
  };
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
      throw new Error("missing typescript record");
    }
    return {
      diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [],
      typescript: parsed.typescript,
    };
  } catch {
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

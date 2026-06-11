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
import { packageRootDir } from "./paths";
import { readProjectConfig } from "./project/readProjectConfig";
import { resolveBinary } from "./resolveBinary";
import { resolveTsgo } from "./resolveTsgo";
import { appendBuildOutput, normalizeBuildOutput } from "./runBuild";
import {
  assertSharedHostCompatibility,
  linkedTransformPlugins,
  selectSharedHostPlugin,
} from "./sharedHostHelpers";
import { outputText, spawnNative } from "./spawnNative";

/**
 * Transform a project and capture TypeScript source output in memory.
 *
 * When no plugins are configured the fast path spawns the native ttsc compiler
 * host (`cmd/ttsc api-transform`) which returns a JSON map of transformed
 * TypeScript sources. When plugins are present:
 *
 * 1. Check-stage plugins run first and abort on failure.
 * 2. If there are no transform-stage plugins the host is used as the transformer.
 * 3. If transform plugins exist they are dispatched through the shared-host binary
 *    with linked plugins passed via `TTSC_LINKED_PLUGINS_JSON`.
 *
 * @returns A `{ result, typescript }` pair where `typescript` maps output paths
 *   to their transformed TypeScript source text.
 */
export function transformProjectInMemory(options: ITtscCompilerContext): {
  dependencies?: Record<string, string[]>;
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

/** Return true when the project or the call-level options declare any plugins. */
function hasConfiguredPlugins(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
): boolean {
  return hasProjectPluginEntries(project, options.plugins);
}

/**
 * Transform via the built-in native compiler host (`cmd/ttsc api-transform`).
 * Used when no user plugins are configured, or as the fallback transformer when
 * check-stage plugins pass and no transform-stage plugins are declared.
 */
function transformProjectWithNativeHost(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
): {
  dependencies?: Record<string, string[]>;
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
    ...(output.dependencies === undefined
      ? {}
      : { dependencies: output.dependencies }),
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
  dependencies?: Record<string, string[]>;
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
  const tsgoBinary =
    loaded.nativePlugins.length === 0
      ? ""
      : resolveTsgo({ ...options, cwd: project.root }).binary;
  const checked = runNativeChecks(
    options,
    project,
    tsgoBinary,
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
      ...(transformed.dependencies === undefined
        ? {}
        : { dependencies: transformed.dependencies }),
      result: appendBuildOutput(checked, transformed.result),
      typescript: transformed.typescript,
    };
  }
  assertSharedHostCompatibility(transformers, "source-to-source");

  const plugin = selectSharedHostPlugin(transformers);
  const res = spawnNative(
    plugin.binary,
    createNativeTransformArgs(project, transformers),
    {
      cwd: project.root,
      env: nativePluginEnv(options, tsgoBinary, loaded.nativePlugins, plugin),
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
    ...(output.dependencies === undefined
      ? {}
      : { dependencies: output.dependencies }),
    result: appendBuildOutput(checked, result),
    typescript: output.typescript,
  };
}

/**
 * Run every check-stage plugin in sequence, short-circuiting on the first
 * failure. Returns the aggregated `TtscBuildResult` (status 0 when all pass).
 */
function runNativeChecks(
  options: ITtscCompilerContext,
  project: ITtscParsedProjectConfig,
  tsgoBinary: string,
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
        env: nativePluginEnv(options, tsgoBinary, nativePlugins, plugin),
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

/** Build the CLI argument list for the `transform` subcommand. */
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

/** Build the CLI argument list for the `check` subcommand. */
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

/**
 * Serialize the plugin list to a JSON string for `--plugins-json=`. Only the
 * fields the native binary needs are included to keep the arg short.
 */
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

/**
 * Build the environment for a native plugin spawn. Injects `TTSC_NODE_BINARY`,
 * `TTSC_TSGO_BINARY`, and `TTSC_TTSX_BINARY` so the sidecar can re-invoke
 * Node.js or tsgo without searching PATH. For transform plugins, also passes
 * `TTSC_LINKED_PLUGINS_JSON` when linked sources are present.
 */
function nativePluginEnv(
  options: ITtscCompilerContext,
  tsgoBinary: string,
  nativePlugins?: readonly ITtscLoadedNativePlugin[],
  plugin?: ITtscLoadedNativePlugin,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TTSC_NODE_BINARY: process.env.TTSC_NODE_BINARY ?? process.execPath,
    TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? tsgoBinary,
    TTSC_TTSX_BINARY:
      process.env.TTSC_TTSX_BINARY ??
      path.join(__dirname, "..", "..", "launcher", "ttsx.js"),
    ...options.env,
  };
  if (plugin?.stage === "transform") {
    const linked = linkedTransformPlugins(nativePlugins ?? []);
    if (linked.length !== 0) {
      env.TTSC_LINKED_PLUGINS_JSON = serializeNativePlugins(linked);
    }
  }
  return env;
}

/**
 * Parse the JSON envelope written by the native transform host to stdout.
 *
 * The `typescript` field must be a `Record<string, string>`. Any other shape is
 * treated as a protocol error and throws with the stderr/stdout context. JSON
 * parse errors are also wrapped with the same context message.
 *
 * The optional `dependencies` field (per-file consulted-source lists, see
 * `ITtscCompilerTransformation`) is forwarded when well-formed; entries that
 * are not string arrays are dropped rather than failing the transform — the
 * field is advisory watch metadata, not output.
 */
function parseNativeTransformOutput(
  stdout: string,
  stderr: string,
): {
  dependencies?: Record<string, string[]>;
  diagnostics: ITtscCompilerDiagnostic[];
  typescript: Record<string, string>;
} {
  try {
    const parsed = JSON.parse(stdout) as {
      dependencies?: Record<string, string[]>;
      diagnostics?: ITtscCompilerDiagnostic[];
      typescript?: Record<string, string>;
    };
    if (!isTextRecord(parsed.typescript)) {
      throw new Error(
        "ttsc: native transform host did not return a TypeScript source map",
      );
    }
    const dependencies = parseDependencyLists(parsed.dependencies);
    return {
      ...(dependencies === undefined ? {} : { dependencies }),
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

/**
 * Normalize the optional `dependencies` envelope field into a record of string
 * arrays, or `undefined` when absent or carrying nothing usable.
 */
function parseDependencyLists(
  value: unknown,
): Record<string, string[]> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string[]> = {};
  for (const [key, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    const files = entries.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (files.length !== 0) {
      output[key] = files;
    }
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/** Type guard: true when `value` is a non-null, non-array object of strings. */
function isTextRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

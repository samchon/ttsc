import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import type { ITtscPlugin } from "../../structures/ITtscPlugin";
import type { ITtscPluginFactoryContext } from "../../structures/ITtscPluginFactoryContext";
import type { ITtscProjectPluginConfig } from "../../structures/ITtscProjectPluginConfig";
import type { TtscPluginStage } from "../../structures/TtscPluginStage";
import type { ITtscLoadedNativePlugin } from "../../structures/internal/ITtscLoadedNativePlugin";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import { buildSourcePlugin } from "./buildSourcePlugin";

type TtscPluginFactory<T = ITtscProjectPluginConfig> = (
  context: ITtscPluginFactoryContext<T>,
) => ITtscPlugin;

export function loadProjectPlugins(options: {
  binary: string;
  cacheDir?: string;
  cwd?: string;
  entries?: readonly ITtscProjectPluginConfig[] | false;
  file?: string;
  tsconfig?: string;
}): {
  nativePlugins: ITtscLoadedNativePlugin[];
  project: ITtscParsedProjectConfig;
} {
  const project = readProjectConfig({
    cwd: options.cwd,
    file: options.file,
    tsconfig: options.tsconfig,
  });
  const entries =
    options.entries === false
      ? []
      : [...(options.entries ?? project.compilerOptions.plugins)].filter(
          (entry) => entry.enabled !== false,
        );
  if (entries.length === 0) {
    return {
      nativePlugins: [],
      project,
    };
  }

  const context = {
    binary: options.binary,
    cwd: path.resolve(options.cwd ?? process.cwd()),
    projectRoot: project.root,
    tsconfig: project.path,
  };
  const plugins = entries.map((entry) =>
    loadPluginEntry(entry, { ...context, plugin: entry }),
  );

  const nativePlugins: ITtscLoadedNativePlugin[] = [];
  const ttscVersion = readTtscVersion();
  const tsgoVersion = readTsgoVersion(context.projectRoot);
  plugins.forEach((plugin, index) => {
    const stage = resolvePluginStage(plugin);
    validatePluginSource(plugin);
    validatePluginHooks(plugin, stage);
    const binary = buildSourcePlugin({
      baseDir: context.projectRoot,
      cacheDir: options.cacheDir,
      pluginName: plugin.name,
      source: plugin.source,
      ttscVersion,
      tsgoVersion,
    });
    nativePlugins.push({
      binary,
      config: entries[index]!,
      hooks: plugin.hooks,
      name: plugin.name,
      stage,
    });
  });
  return {
    nativePlugins,
    project,
  };
}

function loadPluginEntry(
  entry: ITtscProjectPluginConfig,
  context: ITtscPluginFactoryContext,
): ITtscPlugin {
  const specifier = entry.transform;
  if (typeof specifier !== "string" || specifier.length === 0) {
    throw new Error(`ttsc: plugin entry is missing a string "transform" field`);
  }
  rejectUserPhaseOptions(specifier, entry);

  const request = resolvePluginRequest(specifier, context.projectRoot);
  const mod = require(request) as {
    createTtscPlugin?: TtscPluginFactory;
    default?: ITtscPlugin | TtscPluginFactory;
  } & Partial<Record<"plugin", ITtscPlugin | TtscPluginFactory>>;
  const candidate =
    mod.createTtscPlugin ??
    mod.default ??
    mod.plugin ??
    (mod as unknown as ITtscPlugin | TtscPluginFactory);
  if (typeof candidate === "function") {
    const plugin = candidate(context);
    if (!isTtscPlugin(plugin)) {
      throw new Error(
        `ttsc: plugin "${specifier}" does not export a valid ttsc plugin`,
      );
    }
    rejectJsTransformHooks(specifier, plugin);
    return plugin;
  }
  if (isTtscPlugin(candidate)) {
    rejectJsTransformHooks(specifier, candidate);
    return candidate;
  }
  throw new Error(
    `ttsc: plugin "${specifier}" does not export a valid ttsc plugin`,
  );
}

function isTtscPlugin(value: unknown): value is ITtscPlugin {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

function rejectJsTransformHooks(specifier: string, candidate: object): void {
  if ("transformSource" in candidate || "transformOutput" in candidate) {
    throw new Error(
      `ttsc: plugin "${specifier}" declares unsupported JS transform hooks; ` +
        "declare a native backend instead",
    );
  }
}

function rejectUserPhaseOptions(
  specifier: string,
  entry: ITtscProjectPluginConfig,
): void {
  for (const key of [
    "after",
    "afterDeclarations",
    "before",
    "phase",
    "source:after",
  ]) {
    if (key in entry) {
      throw new Error(
        `ttsc: plugin entry for "${specifier}" uses unsupported ts-patch option ${JSON.stringify(key)}; ` +
          "ttsc plugins declare source/declaration hooks in the package descriptor, not in user tsconfig",
      );
    }
  }
}

function resolvePluginStage(plugin: ITtscPlugin): TtscPluginStage {
  if (plugin.stage === undefined) {
    return "transform";
  }
  if (!isPluginStage(plugin.stage)) {
    if (plugin.stage === "output") {
      throw new Error(
        `ttsc: plugin "${plugin.name}" requested removed stage "output"; ` +
          "upgrade the plugin to a transform hook descriptor compatible with this ttsc version",
      );
    }
    throw new Error(
      `ttsc: plugin "${plugin.name}" requested unsupported stage ${JSON.stringify(plugin.stage)}`,
    );
  }
  return plugin.stage;
}

function validatePluginSource(plugin: ITtscPlugin): void {
  if (typeof plugin.source !== "string" || plugin.source.length === 0) {
    throw new Error(`ttsc: plugin "${plugin.name}" must declare source`);
  }
}

function validatePluginHooks(
  plugin: ITtscPlugin,
  stage: TtscPluginStage,
): void {
  const hooks = plugin.hooks;
  if (hooks !== undefined && typeof hooks !== "object") {
    throw new Error(`ttsc: plugin "${plugin.name}" hooks must be an object`);
  }
  if (stage === "check") {
    if (hooks !== undefined && Object.keys(hooks).length !== 0) {
      throw new Error(
        `ttsc: check plugin "${plugin.name}" must not declare transform hooks`,
      );
    }
    return;
  }
  if (hooks === undefined) {
    throw new Error(
      `ttsc: transform plugin "${plugin.name}" must declare source/declaration hooks in its package descriptor`,
    );
  }
  for (const key of Object.keys(hooks)) {
    if (key !== "source" && key !== "declaration") {
      throw new Error(
        `ttsc: plugin "${plugin.name}" requested unsupported hook ${JSON.stringify(key)}`,
      );
    }
  }
  if (hooks.source !== undefined && typeof hooks.source !== "boolean") {
    throw new Error(
      `ttsc: plugin "${plugin.name}" hooks.source must be boolean`,
    );
  }
  if (
    hooks.declaration !== undefined &&
    typeof hooks.declaration !== "boolean"
  ) {
    throw new Error(
      `ttsc: plugin "${plugin.name}" hooks.declaration must be boolean`,
    );
  }
  if (hooks.source !== true && hooks.declaration !== true) {
    throw new Error(
      `ttsc: transform plugin "${plugin.name}" must enable at least one source/declaration hook`,
    );
  }
}

function isPluginStage(value: string): value is TtscPluginStage {
  return value === "transform" || value === "check";
}

function resolvePluginRequest(specifier: string, projectRoot: string): string {
  if (path.isAbsolute(specifier)) {
    return specifier;
  }
  if (isRelativePluginSpecifier(specifier)) {
    return path.resolve(projectRoot, specifier);
  }
  return require.resolve(specifier, { paths: [projectRoot] });
}

function isRelativePluginSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}

let cachedTtscVersion: string | null = null;

function readTtscVersion(): string {
  if (cachedTtscVersion !== null) {
    return cachedTtscVersion;
  }
  try {
    const file = path.resolve(__dirname, "..", "..", "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as {
      version?: string;
    };
    cachedTtscVersion = pkg.version ?? "0.0.0";
  } catch {
    cachedTtscVersion = "0.0.0";
  }
  return cachedTtscVersion;
}

function readTsgoVersion(projectRoot: string): string {
  try {
    const projectRequire = createRequire(
      path.join(projectRoot, "package.json"),
    );
    const pkgPath = projectRequire.resolve(
      "@typescript/native-preview/package.json",
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

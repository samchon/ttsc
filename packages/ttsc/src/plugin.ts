import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

import {
  type NativeRewriteMode,
  type TtscNativeBackend,
  resolveNativeBackend,
} from "./native";
import {
  type ParsedProjectConfig,
  type ProjectPluginConfig,
  readProjectConfig,
} from "./project";
import { buildSourcePlugin } from "./source-build";

export type {
  NativePluginContractVersion,
  NativeRewriteMode,
  TtscNativeBackend,
  TtscNativeSource,
} from "./native";

export interface TtscPluginFactoryContext {
  binary: string;
  cwd: string;
  projectRoot: string;
  tsconfig: string;
}

export interface TtscPlugin {
  name: string;
  native?: TtscNativeBackend;
  /** @deprecated Use `native.mode` instead. */
  nativeMode?: NativeRewriteMode;
  /** @deprecated Use `native.binary` instead. */
  nativeBinary?: string;
}

export type TtscPluginFactory = (
  config: ProjectPluginConfig,
  context: TtscPluginFactoryContext,
) => TtscPlugin;

export type TtscPluginModule = TtscPlugin | TtscPluginFactory;

export interface LoadedNativePlugin {
  backend: TtscNativeBackend;
  config: ProjectPluginConfig;
  name: string;
}

export interface LoadedPlugins {
  compatibilityFallback: boolean;
  nativeBinary: string | null;
  nativeBinaries: string[];
  nativePlugins: LoadedNativePlugin[];
  plugins: TtscPlugin[];
  project: ParsedProjectConfig;
}

export interface LoadPluginsOptions {
  binary: string;
  cwd?: string;
  entries?: readonly ProjectPluginConfig[] | false;
  file?: string;
  tsconfig?: string;
}

export function definePlugin<T extends TtscPluginModule>(plugin: T): T {
  return plugin;
}

export function loadProjectPlugins(options: LoadPluginsOptions): LoadedPlugins {
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
      compatibilityFallback: false,
      nativeBinary: null,
      nativeBinaries: [],
      nativePlugins: [],
      plugins: [],
      project,
    };
  }

  const context: TtscPluginFactoryContext = {
    binary: options.binary,
    cwd: path.resolve(options.cwd ?? process.cwd()),
    projectRoot: project.root,
    tsconfig: project.path,
  };
  const plugins = entries.map((entry) => loadPluginEntry(entry, context));

  const nativePlugins: LoadedNativePlugin[] = [];
  const ttscVersion = readTtscVersion();
  const tsgoVersion = readTsgoVersion(context.projectRoot);
  plugins.forEach((plugin, index) => {
    let backend = resolveNativeBackend(plugin);
    if (!backend) {
      return;
    }
    if (backend.source && !backend.binary) {
      const built = buildSourcePlugin({
        baseDir: context.projectRoot,
        pluginName: plugin.name,
        source: backend.source,
        ttscVersion,
        tsgoVersion,
      });
      backend = { ...backend, binary: built };
    }
    nativePlugins.push({ backend, config: entries[index]!, name: plugin.name });
  });
  if (nativePlugins.length !== plugins.length) {
    const missing = plugins
      .filter((plugin) => !resolveNativeBackend(plugin))
      .map((plugin) => plugin.name)
      .join(", ");
    throw new Error(
      `ttsc: every plugin must declare a native backend; missing native for ${missing}`,
    );
  }
  return {
    compatibilityFallback: false,
    nativeBinary: nativePlugins[0]?.backend.binary ?? null,
    nativeBinaries: [
      ...new Set(
        nativePlugins
          .map((plugin) => plugin.backend.binary)
          .filter((binary): binary is string => typeof binary === "string"),
      ),
    ],
    nativePlugins,
    plugins,
    project,
  };
}

function loadPluginEntry(
  entry: ProjectPluginConfig,
  context: TtscPluginFactoryContext,
): TtscPlugin {
  const specifier = entry.transform;
  if (typeof specifier !== "string" || specifier.length === 0) {
    throw new Error(`ttsc: plugin entry is missing a string "transform" field`);
  }

  const request = resolvePluginRequest(specifier, context.projectRoot);
  const mod = require(request) as {
    createTtscPlugin?: TtscPluginFactory;
    default?: TtscPluginModule;
  } & Partial<Record<"plugin", TtscPluginModule>>;
  const candidate =
    mod.createTtscPlugin ??
    mod.default ??
    mod.plugin ??
    (mod as unknown as TtscPluginModule);
  if (typeof candidate === "function") {
    const plugin = candidate(entry, context);
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

function isTtscPlugin(value: unknown): value is TtscPlugin {
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

function resolvePluginRequest(specifier: string, projectRoot: string): string {
  if (path.isAbsolute(specifier)) {
    return specifier;
  }
  if (isRelativePluginSpecifier(specifier)) {
    return path.resolve(projectRoot, specifier);
  }
  try {
    return require.resolve(specifier, { paths: [projectRoot] });
  } catch (error) {
    const sourceFallback = resolveSourceCheckoutPlugin(specifier, projectRoot);
    if (sourceFallback) {
      return sourceFallback;
    }
    throw error;
  }
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

function resolveSourceCheckoutPlugin(
  specifier: string,
  projectRoot: string,
): string | null {
  const normalized = specifier.replace(/\\/g, "/");
  const match = normalized.match(/^(.*)\/lib\/transform$/);
  if (!match) {
    return null;
  }
  try {
    const packageJson = require.resolve(`${match[1]}/package.json`, {
      paths: [projectRoot],
    });
    const packageRoot = path.dirname(packageJson);
    const candidates = [
      path.join(packageRoot, "lib", "transform.js"),
      path.join(packageRoot, "src", "transform.ts"),
      path.join(packageRoot, "bin", "ttsc-plugin.cjs"),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
  } catch {
    return null;
  }
}

let cachedTtscVersion: string | null = null;

function readTtscVersion(): string {
  if (cachedTtscVersion !== null) {
    return cachedTtscVersion;
  }
  try {
    const file = path.resolve(__dirname, "..", "package.json");
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
    const projectRequire = createRequire(path.join(projectRoot, "package.json"));
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

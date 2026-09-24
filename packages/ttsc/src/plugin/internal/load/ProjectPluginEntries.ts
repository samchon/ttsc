import path from "node:path";

import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import { PluginPackageResolution } from "./PluginPackageResolution";
import { isRelativePluginSpecifier } from "./isRelativePluginSpecifier";

/**
 * The plugin entries a project declares, from its `tsconfig.json` and from the
 * `ttsc` block of its direct dependencies' manifests.
 *
 * Every entry carries the directory its specifier resolves from. A bare package
 * specifier resolves from the project root, never from the base config an
 * `extends` chain declared it in; a relative one resolves from the file that
 * wrote it.
 */
export namespace ProjectPluginEntries {
  /** One declared plugin and the directory its specifier resolves from. */
  export type ProjectPluginEntry = {
    /** Directory the plugin's `transform` specifier is resolved against. */
    baseDir: string;
    /** The entry as the project declared it. */
    config: ITtscProjectPluginConfig;
  };

  /**
   * The project's plugin entries in declaration order: `entries` when a caller
   * passed an explicit list, otherwise the tsconfig's `compilerOptions.plugins`
   * followed by the plugins its direct dependencies publish automatically.
   */
  export function resolvePluginEntries(
    project: ITtscParsedProjectConfig,
    entries?: readonly ITtscProjectPluginConfig[],
  ): ProjectPluginEntry[] {
    if (entries !== undefined) {
      return entries.map((config) => ({
        baseDir: project.root,
        config,
      }));
    }
    const configured = project.compilerOptions.plugins.map((config, index) => {
      // A bare/package plugin specifier (e.g. "typia/lib/transform") must resolve
      // from the project's own node_modules, not from the tsconfig that declared
      // it: an `extends`ed base config (a shared `tests/config/tsconfig.json`)
      // declares the plugin, but the package is installed under the consuming
      // project. Only a relative specifier ("./plugin") is meaningful relative to
      // the declaring config's directory. Mirrors discoverPackagePluginEntries.
      const declaringDir = project.pluginBaseDirs[index];
      const baseDir =
        typeof config.transform === "string" &&
        isRelativePluginSpecifier(config.transform) &&
        declaringDir !== undefined
          ? declaringDir
          : project.root;
      return { baseDir, config };
    });
    return [
      ...configured,
      ...discoverPackagePluginEntries(project, configured),
    ];
  }

  function discoverPackagePluginEntries(
    project: ITtscParsedProjectConfig,
    configured: readonly ProjectPluginEntry[],
  ): ProjectPluginEntry[] {
    const projectPackageJson = PluginPackageResolution.findNearestPackageJson(
      project.root,
    );
    if (projectPackageJson === undefined) {
      return [];
    }
    const projectPackageRoot = path.dirname(projectPackageJson);
    const projectManifest =
      PluginPackageResolution.readPackageManifest(projectPackageJson);
    if (projectManifest === undefined) {
      return [];
    }

    const configuredTransforms = createConfiguredTransformSet(configured);
    const out: ProjectPluginEntry[] = [];
    for (const name of PluginPackageResolution.directDependencyNames(
      projectManifest,
    )) {
      const packageJson = PluginPackageResolution.resolveDependencyPackageJson(
        name,
        projectPackageRoot,
      );
      if (packageJson === undefined) {
        continue;
      }
      const manifest = PluginPackageResolution.readPackageManifest(packageJson);
      const config = readPackagePluginConfig(name, manifest);
      if (config === undefined || config.enabled === false) {
        continue;
      }
      const packageRoot = path.dirname(packageJson);
      const transform = config.transform;
      if (typeof transform !== "string") {
        continue;
      }
      const baseDir = isRelativePluginSpecifier(transform)
        ? packageRoot
        : projectPackageRoot;
      const resolved = PluginPackageResolution.resolvePluginRequest(
        transform,
        baseDir,
      );
      if (hasConfiguredTransform(configuredTransforms, transform, resolved)) {
        continue;
      }
      out.push({
        baseDir,
        config,
      });
      addConfiguredTransform(configuredTransforms, transform, resolved);
    }
    return out;
  }

  type ConfiguredTransformSet = {
    raw: Set<string>;
    resolved: Set<string>;
  };

  function createConfiguredTransformSet(
    entries: readonly ProjectPluginEntry[],
  ): ConfiguredTransformSet {
    const raw = new Set<string>();
    const resolved = new Set<string>();
    for (const entry of entries) {
      const transform = entry.config.transform;
      if (typeof transform !== "string" || transform.length === 0) {
        continue;
      }
      if (!isRelativePluginSpecifier(transform)) {
        raw.add(transform);
      }
      try {
        resolved.add(
          PluginPackageResolution.resolvePluginRequest(
            transform,
            entry.baseDir,
          ),
        );
      } catch {
        // Keep the normal plugin loading error path for invalid explicit entries.
      }
    }
    return { raw, resolved };
  }

  function hasConfiguredTransform(
    configuredTransforms: ConfiguredTransformSet,
    transform: string,
    resolved: string,
  ): boolean {
    return (
      configuredTransforms.resolved.has(resolved) ||
      (!isRelativePluginSpecifier(transform) &&
        configuredTransforms.raw.has(transform))
    );
  }

  function addConfiguredTransform(
    configuredTransforms: ConfiguredTransformSet,
    transform: string,
    resolved: string,
  ): void {
    if (!isRelativePluginSpecifier(transform)) {
      configuredTransforms.raw.add(transform);
    }
    configuredTransforms.resolved.add(resolved);
  }

  function readPackagePluginConfig(
    packageName: string,
    manifest: PluginPackageResolution.PackageManifest | undefined,
  ): ITtscProjectPluginConfig | undefined {
    const ttsc = manifest?.ttsc;
    if (!PluginPackageResolution.isRecord(ttsc) || !("plugin" in ttsc)) {
      return undefined;
    }
    const plugin = ttsc.plugin;
    if (!PluginPackageResolution.isRecord(plugin) || Array.isArray(plugin)) {
      throw new Error(
        `ttsc: package ${JSON.stringify(packageName)} declares invalid "ttsc.plugin"; expected an object`,
      );
    }
    if (typeof plugin.transform !== "string" || plugin.transform.length === 0) {
      throw new Error(
        `ttsc: package ${JSON.stringify(packageName)} declares invalid "ttsc.plugin.transform"; expected a non-empty string`,
      );
    }
    return { ...plugin } as ITtscProjectPluginConfig;
  }
}

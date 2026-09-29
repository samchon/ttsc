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
 *
 * @evidence contracts/common.md#principled-implementation Explicit entries replace discovery; otherwise inherited relative transforms retain their declaring base while bare packages resolve from the consumer, followed by distinct direct-dependency markers.
 * @evidence contracts/common.md#clear-and-simple-design Entry extraction owns ordering/provenance and delegates physical package resolution; descriptor execution/building remain outside discovery.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Deduplication compares actual resolved identity plus bare specifier names, avoiding consumer-name path exceptions and duplicate auto-loads of explicitly configured plugins.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains declaring-config versus consumer bases and explicit/discovered order; helper comments explain marker validation and deduplication, with tag separation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Shared relative-specifier classification accepts both native separator spellings; native dirname and shared resolution preserve actual package roots instead of assuming inherited configs own node_modules.
 * @evidence contracts/performance.md#efficient-algorithms Configured transforms are indexed once in raw/resolved Sets, making automatic-entry duplicate checks average constant time after resolution instead of rescanning all configured entries.
 * @evidence contracts/performance.md#reuse-equivalent-work The invocation-local resolved Set shares identity decisions for deduplication; current package reads are not retained across calls and persistent answers belong to descriptor/capability caches.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Discovery collections and returned entries are call-owned; no retained resource or cross-call population is acquired.
 */
export namespace ProjectPluginEntries {
  /**
   * One declared plugin and the directory its specifier resolves from.
   *
   * @evidence contracts/common.md#principled-implementation Pairing original config with its resolution base preserves inherited relative selection without changing plugin-owned payload fields.
   * @evidence contracts/common.md#clear-and-simple-design Two fields carry entry value and provenance directly rather than embedding resolver/build state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The base is actual declaration/consumer provenance, not a hardcoded package or fixture location.
   * @evidence contracts/common.md#meaningful-documentation Native member comments identify config preservation and transform resolution base, with blank member/tag spacing following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation The base is a native directory supplied by discovery; native path resolution remains with the loader and does not require POSIX spelling here.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms This entry type executes no discovery or resolution algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Provenance data establishes no reusable-answer cache by itself.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The record retains plain caller-owned data rather than handles or a cross-call population.
   */
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
   *
   * @evidence contracts/common.md#principled-implementation Explicit array selection bypasses automatic discovery; inherited relative entries use their declaring directories, while bare entries and automatic dependency lookup use the consuming project's package authority.
   * @evidence contracts/common.md#clear-and-simple-design One ordered entry operation delegates package lookup and contains the invocation's deduplication state, leaving descriptor evaluation to the loader.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual supported config provenance determines bases, and automatic markers are validated rather than silently repaired into guessed plugin configurations.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states explicit versus discovered ordering; private code comments explain inherited-base choice and invalid-marker diagnostics, with separate tags following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Shared relative detection and native dirname/shared resolver preserve OS-neutral consumer/declarer bases, including Windows relative config spelling.
   * @evidence contracts/performance.md#efficient-algorithms Configured entries are processed once into raw/resolved Sets; each discovered dependency performs resolution and average-constant duplicate membership checks.
   * @evidence contracts/performance.md#reuse-equivalent-work Invocation-local transform identity indexes are reused across every automatic entry, without caching mutable package authority across calls.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The output and Set indexes are invocation-owned and acquire no persistent resource or collection.
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

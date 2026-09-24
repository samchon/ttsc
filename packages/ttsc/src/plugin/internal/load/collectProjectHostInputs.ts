import { createRequire } from "node:module";
import path from "node:path";

import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import { PluginPackageResolution } from "./PluginPackageResolution";
import { moduleResolutionBaseSelects } from "./moduleResolutionBaseSelects";

/** Return config ancestry and the manifest controlling package discovery. */
export function collectProjectHostInputs(
  project: ITtscParsedProjectConfig,
  includePluginDiscovery: boolean = true,
): string[] {
  const inputs = new Set<string>(
    project.configPaths.map((file) => path.resolve(file)),
  );
  if (!includePluginDiscovery) return [...inputs].sort();
  const manifestCandidates =
    PluginPackageResolution.collectNearestPackageJsonCandidates(project.root);
  for (const candidate of manifestCandidates) inputs.add(candidate);
  const manifest = manifestCandidates.find(
    PluginPackageResolution.existingFile,
  );
  if (manifest !== undefined) {
    const projectManifest =
      PluginPackageResolution.readPackageManifest(manifest);
    if (projectManifest !== undefined) {
      const projectRoot = path.dirname(manifest);
      for (const dependency of PluginPackageResolution.directDependencyNames(
        projectManifest,
      )) {
        const dependencyManifest =
          PluginPackageResolution.resolveDependencyPackageJson(
            dependency,
            projectRoot,
          );
        for (const candidate of collectDependencyManifestCandidates(
          dependency,
          manifest,
          dependencyManifest,
        )) {
          inputs.add(candidate);
        }
        if (dependencyManifest !== undefined) {
          inputs.add(path.resolve(dependencyManifest));
        }
      }
    }
  }
  return [...inputs].sort();
}

/**
 * Record package manifests whose later appearance can redirect discovery: the
 * manifest of each search root's package directory, through the root that
 * selects the manifest discovery read (`moduleResolutionBaseSelects`), or every
 * root when none was found.
 */
function collectDependencyManifestCandidates(
  packageName: string,
  parentFile: string,
  selectedManifest: string | undefined,
): string[] {
  const out: string[] = [];
  for (const searchPath of createRequire(parentFile).resolve.paths(
    packageName,
  ) ?? []) {
    const packageDirectory = path.join(searchPath, ...packageName.split("/"));
    out.push(path.join(packageDirectory, "package.json"));
    if (moduleResolutionBaseSelects(packageDirectory, selectedManifest, []))
      break;
  }
  return out;
}

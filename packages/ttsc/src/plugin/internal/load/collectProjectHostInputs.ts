import { createRequire } from "node:module";
import path from "node:path";

import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import { PluginPackageResolution } from "./PluginPackageResolution";
import { moduleResolutionBaseSelects } from "./moduleResolutionBaseSelects";

/**
 * Return config ancestry and package-discovery manifest inputs, including
 * missing nearer candidates that could redirect the selected package later.
 *
 * @evidence contracts/common.md#principled-implementation Config ancestry, lexical selection and missing config candidates influence selection; automatic discovery additionally observes nearest manifest and dependency search candidates through the selecting root. The project reader separately states whether these config observations are complete.
 * @evidence contracts/common.md#clear-and-simple-design The collector obtains package resolution from its owner and assembles universal loader inputs, leaving source Program dependencies to the native reference graph.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing candidates are real future selection inputs; farther unconsulted roots are not added as compensating guesses, and explicit plugin lists can avoid automatic discovery.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc identifies ancestry and missing discovery candidates; the private helper explains the selected-root stopping condition, with paragraph/tag separation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native resolve/dirname/join and Node createRequire search paths construct OS-neutral host inputs; package-name slash splitting is package-specifier grammar, not filesystem parsing.
 * @evidence contracts/performance.md#efficient-algorithms A Set deduplicates observed paths, then one sort stabilizes the result; dependency manifest search stops at its selecting root rather than observing every ancestor indiscriminately.
 * @evidence contracts/performance.md#reuse-equivalent-work The operation assembles one shared universal input population for the load; identical candidate paths are retained once by the Set, while current filesystem resolution is not cached here.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The Set and returned array belong to this call, with no cross-call retention or acquired open resource.
 */
export function collectProjectHostInputs(
  project: ITtscParsedProjectConfig,
  includePluginDiscovery: boolean = true,
): string[] {
  const inputs = new Set<string>(
    [...project.configPaths, ...(project.configInputs ?? [])].map((file) =>
      path.resolve(file),
    ),
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

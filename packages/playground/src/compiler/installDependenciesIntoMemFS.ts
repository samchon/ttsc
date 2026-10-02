import type { IMemFSHost } from "@ttsc/wasm";

import type { ICompilerService } from "../structures/ICompilerService";
import { normalizeNodeModulePath } from "./normalizeNodeModulePath";

/**
 * Mount external npm package files into the worker's MemFS under
 * `<workDir>/node_modules/...`.
 *
 * Used by `createWorkerCompiler` to implement the `installDependencies` verb of
 * `ICompilerService`. The dependency installer (UI side) feeds keys like
 * `node_modules/uuid/dist/index.js`; we normalize, sanity-check, and copy each
 * entry under the project root.
 *
 * @evidence contracts/common.md#principled-implementation Every file passes the node_modules-relative path gate before virtual writes; count reports accepted writes and metadata remains the caller's submitted list.
 * @evidence contracts/common.md#clear-and-simple-design Mounting is one loop with path policy delegated to normalizeNodeModulePath and no registry-resolution responsibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed paths are uniformly skipped according to the declared mounting contract, without package-specific exemptions.
 * @evidence contracts/common.md#meaningful-documentation Native prose defines input namespace, project-root mapping and consumer ownership, following documentation-skill paragraphs.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It keeps no state, handle or listener after returning.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A single pass or constant work over its arguments; no algorithm choice scales beyond that.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call serves one request; there is no equivalent work to share across calls.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation Works on in-memory strings and the wasm virtual filesystem; it reaches no native filesystem, path-identity or process boundary.
 */
export function installDependenciesIntoMemFS(
  host: IMemFSHost,
  workDir: string,
  props: ICompilerService.IInstallDependenciesProps,
): ICompilerService.IInstallDependenciesResult {
  let fileCount = 0;
  for (const [rel, text] of Object.entries(props.files)) {
    const normalized = normalizeNodeModulePath(rel);
    if (!normalized) continue;
    host.writeFile(`${workDir}/${normalized}`, text);
    fileCount++;
  }
  return { installed: props.packages, fileCount };
}

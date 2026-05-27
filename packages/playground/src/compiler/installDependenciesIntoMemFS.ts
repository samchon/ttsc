import type { IMemFSHost } from "@ttsc/wasm";

import type { ICompilerService } from "../structures/ICompilerService";
import { normalizeNodeModulePath } from "./normalizeNodeModulePath";

/**
 * Mount external npm package files into the worker's MemFS under
 * `<workDir>/node_modules/...`.
 *
 * Used by `createWorkerCompiler` to implement the `installDependencies` verb
 * of `ICompilerService`. The dependency installer (UI side) feeds keys like
 * `node_modules/uuid/dist/index.js`; we normalize, sanity-check, and copy
 * each entry under the project root.
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

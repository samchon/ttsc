import path from "node:path";

import { absolutizePathsTarget } from "./absolutizePathsTarget";
import { findDeclaredFileSpecs } from "./findDeclaredFileSpecs";
import { startsWithConfigDirTemplate } from "./startsWithConfigDirTemplate";

/** Top-level file specifications that accept the same template. */
const CONFIG_DIR_TEMPLATE_FILE_SPECS = ["exclude", "files", "include"] as const;

/**
 * Materialize inherited file specifications whose `${configDir}` owner would
 * otherwise move to a generated wrapper's scratch directory.
 *
 * Lists use the compiler's last-inherited-array rule: a later base declaring
 * null cannot erase an earlier array. Invalid elements are preserved so this
 * overlay does not hide the compiler's configuration diagnostics.
 *
 * @param configDir The directory `${configDir}` stands for, as
 *   `readEffectiveTsconfigTemplateCompilerOptions` takes it.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Template-bearing file lists are materialized at the final consumer rather
 *   than the scratch wrapper. Ordinary entries keep their declaring anchors
 *   and list order; the compiler owns invalid non-string element diagnostics.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One loop handles the three top-level template list carriers and delegates
 *   declaration precedence and anchoring to their shared owners.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Template and ordinary entries use their distinct native anchors through
 *   the shared resolver, then config-pattern separators become forward slashes.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No temporary-directory special case changes include/exclude meaning; the
 *   compiler's template semantics determine the materialization boundary.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native description explains wrapper relocation and configDir ownership;
 *   argument prose remains separate from acknowledgment tags.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Visits the three file-spec keys once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function readEffectiveTsconfigTemplateFileSpecs(
  tsconfig: string,
  configDir: string = path.dirname(path.resolve(tsconfig)),
): Record<string, unknown> {
  const resolved = path.resolve(tsconfig);
  const output: Record<string, unknown> = {};
  for (const key of CONFIG_DIR_TEMPLATE_FILE_SPECS) {
    const declared = findDeclaredFileSpecs(resolved, key);
    if (
      declared === null ||
      declared === undefined ||
      !declared.rawSpecs.some(
        (entry) =>
          typeof entry === "string" && startsWithConfigDirTemplate(entry),
      )
    ) {
      continue;
    }
    output[key] = declared.rawSpecs.map((entry) =>
      typeof entry === "string"
        ? absolutizePathsTarget(declared.baseDir, entry, configDir)
        : entry,
    );
  }
  return output;
}

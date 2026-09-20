import path from "node:path";

import { absolutizePathsTarget } from "./absolutizePathsTarget";
import { findDeclaredValue } from "./findDeclaredValue";
import { startsWithConfigDirTemplate } from "./startsWithConfigDirTemplate";

/** Top-level file specifications that accept the same template. */
const CONFIG_DIR_TEMPLATE_FILE_SPECS = ["exclude", "files", "include"] as const;

/**
 * Materialize inherited file specifications whose `${configDir}` owner would
 * otherwise move to a generated wrapper's scratch directory.
 *
 * @param configDir The directory `${configDir}` stands for, as
 *   `readEffectiveTsconfigTemplateCompilerOptions` takes it.
 */
export function readEffectiveTsconfigTemplateFileSpecs(
  tsconfig: string,
  configDir: string = path.dirname(path.resolve(tsconfig)),
): Record<string, unknown> {
  const resolved = path.resolve(tsconfig);
  const output: Record<string, unknown> = {};
  for (const key of CONFIG_DIR_TEMPLATE_FILE_SPECS) {
    const declared = findDeclaredValue(
      resolved,
      (parsed) =>
        Object.prototype.hasOwnProperty.call(parsed, key)
          ? (parsed as Record<string, unknown>)[key]
          : undefined,
      new Set(),
    );
    if (
      declared === null ||
      !Array.isArray(declared.value) ||
      !declared.value.some(
        (entry) =>
          typeof entry === "string" && startsWithConfigDirTemplate(entry),
      )
    ) {
      continue;
    }
    output[key] = declared.value.map((entry) =>
      typeof entry === "string"
        ? absolutizePathsTarget(declared.baseDir, entry, configDir)
        : entry,
    );
  }
  return output;
}

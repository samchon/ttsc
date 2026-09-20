import path from "node:path";

import { CONFIG_DIR_TEMPLATE_LIST_OPTIONS } from "./CONFIG_DIR_TEMPLATE_LIST_OPTIONS";
import { CONFIG_DIR_TEMPLATE_SCALAR_OPTIONS } from "./CONFIG_DIR_TEMPLATE_SCALAR_OPTIONS";
import { absolutizePathsTarget } from "./absolutizePathsTarget";
import { findDeclaredCompilerOption } from "./findDeclaredCompilerOption";
import { findDeclaredPaths } from "./findDeclaredPaths";
import { resolveConfigDirTemplatePath } from "./resolveConfigDirTemplatePath";
import { startsWithConfigDirTemplate } from "./startsWithConfigDirTemplate";

/**
 * Materialize inherited compiler paths whose `${configDir}` owner would move
 * when a generated wrapper becomes the final config in the chain.
 *
 * Only template-bearing options are returned. Ordinary inherited paths are
 * already made absolute while TypeScript parses their declaring config, while
 * template paths deliberately survive until the final consumer is known.
 *
 * @param configDir The directory `${configDir}` stands for: that of the final
 *   consumer as its reader spells it, which for the compiler is the physical
 *   one (samchon/ttsc#1456). Defaults to the config's own directory as named.
 */
export function readEffectiveTsconfigTemplateCompilerOptions(
  tsconfig: string,
  configDir: string = path.dirname(path.resolve(tsconfig)),
): Record<string, unknown> {
  const resolved = path.resolve(tsconfig);
  const output: Record<string, unknown> = {};
  for (const key of CONFIG_DIR_TEMPLATE_SCALAR_OPTIONS) {
    const declared = findDeclaredCompilerOption(resolved, key);
    if (
      declared !== null &&
      typeof declared.value === "string" &&
      startsWithConfigDirTemplate(declared.value)
    ) {
      output[key] = resolveConfigDirTemplatePath(
        declared.baseDir,
        declared.value,
        configDir,
      );
    }
  }
  for (const key of CONFIG_DIR_TEMPLATE_LIST_OPTIONS) {
    const declared = findDeclaredCompilerOption(resolved, key);
    if (
      declared !== null &&
      Array.isArray(declared.value) &&
      declared.value.some(
        (entry) =>
          typeof entry === "string" && startsWithConfigDirTemplate(entry),
      )
    ) {
      output[key] = declared.value.map((entry) =>
        typeof entry === "string"
          ? resolveConfigDirTemplatePath(declared.baseDir, entry, configDir)
          : entry,
      );
    }
  }

  const declaredPaths = findDeclaredPaths(resolved, new Set());
  if (
    declaredPaths !== null &&
    Object.values(declaredPaths.paths).some(
      (targets) =>
        Array.isArray(targets) &&
        targets.some(
          (target) =>
            typeof target === "string" && startsWithConfigDirTemplate(target),
        ),
    )
  ) {
    output.paths = Object.fromEntries(
      Object.entries(declaredPaths.paths).map(([key, targets]) => [
        key,
        Array.isArray(targets)
          ? targets.map((target) =>
              typeof target === "string"
                ? absolutizePathsTarget(
                    declaredPaths.baseDir,
                    target,
                    configDir,
                  )
                : target,
            )
          : targets,
      ]),
    );
  }
  return output;
}

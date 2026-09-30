import fs from "node:fs";
import path from "node:path";
import type { ITtscPlugin } from "../../../structures/ITtscPlugin";
import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import { resolvePluginGoModule } from "../source/resolvePluginGoModule";
import { pluginLabel } from "./pluginLabel";
import { requirePluginSource } from "./requirePluginSource";

/**
 * Resolve the Go module and executable or linked ownership of a source.
 *
 * @evidence contracts/common.md#principled-implementation Actual module/package resolution and the first production Go package declaration determine executable versus linked source identity independently of plugin name.
 * @evidence contracts/common.md#clear-and-simple-design Module discovery, directory admission and package parsing are separate owning operations; the private scanner only reads immediate production Go files.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Classification invokes the real source resolver and native filesystem rather than a guessed kind or cached filename.
 * @evidence contracts/common.md#meaningful-documentation The headline explains native ownership and the Go module returned to the loader.
 *
 * @evidence contracts/portability.md#os-neutral-implementation The module resolver and native fs/path operations preserve actual directory and file identity; no platform case or path separator heuristic selects ownership.
 * @evidence contracts/performance.md#efficient-algorithms After bounded ancestor module discovery, the scanner visits immediate entries and reads candidate production Go files until it finds a package declaration; it does not recursively traverse module payload.
 * @evidence contracts/performance.md#reuse-equivalent-work Classification reobserves the supplied source because its files and package declaration can change between loads; repeated label selection is shared through one pure owning helper.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Directory entries and file strings remain local to one query and synchronous reads leave no retained source handle or global classification cache.
 */
export function resolveNativeSource(
  source: string,
  plugin: ITtscPlugin,
  config: ITtscProjectPluginConfig,
  index: number,
): { kind: "executable" | "linked"; moduleRoot: string } {
  const label = pluginLabel(plugin, config, index);
  requirePluginSource(source, label);
  const { moduleRoot, packageDir } = resolvePluginGoModule(source, label);
  const packageName = readGoPackageName(packageDir);
  if (packageName === null) {
    throw new Error(
      `ttsc: plugin "${label}" source must contain at least one non-test ".go" file with a package declaration: ${packageDir}`,
    );
  }
  return {
    kind: packageName === "main" ? "executable" : "linked",
    moduleRoot,
  };
}

function readGoPackageName(dir: string): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      !entry.isFile() ||
      !entry.name.endsWith(".go") ||
      entry.name.endsWith("_test.go")
    ) {
      continue;
    }
    const file = path.join(dir, entry.name);
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*package\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(line);
      if (match) {
        return match[1]!;
      }
    }
  }
  return null;
}

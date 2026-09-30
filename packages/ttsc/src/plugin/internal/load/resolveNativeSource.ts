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
 * @evidence contracts/common.md#principled-implementation Actual module/package resolution and the leading production Go package clause determine executable versus linked source identity independently of plugin name; Go comments, initial BOM and Unicode identifiers retain their lexical meaning.
 * @evidence contracts/common.md#clear-and-simple-design Module discovery, directory admission and package parsing are separate owning operations; the private scanner only reads immediate production Go files.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Classification invokes the real source resolver and native filesystem rather than a guessed kind or cached filename.
 * @evidence contracts/common.md#meaningful-documentation The headline explains native ownership and the Go module returned to the loader.
 *
 * @evidence contracts/portability.md#os-neutral-implementation The module resolver and native fs/path operations preserve actual directory and file identity; no platform case or path separator heuristic selects ownership.
 * @evidence contracts/performance.md#efficient-algorithms After ancestor module discovery, the scanner visits immediate entries and reads candidate production Go files until it finds a package clause. Each file read scales with its bytes; lexical scanning only visits its leading trivia and two identifiers, without allocating a line array or recursively traversing module payload.
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
    const packageName = readGoPackageClause(fs.readFileSync(file, "utf8"));
    if (packageName !== null) return packageName;
  }
  return null;
}

/** Read only the package-clause prefix; Go compilation validates the file body. */
function readGoPackageClause(source: string): string | null {
  const identifier = /[_\p{L}][_\p{L}\p{Nd}]*/uy;
  let offset = skipGoTrivia(source, source.charCodeAt(0) === 0xfeff ? 1 : 0);
  if (offset < 0) return null;
  identifier.lastIndex = offset;
  if (identifier.exec(source)?.[0] !== "package") return null;
  offset = skipGoTrivia(source, identifier.lastIndex);
  if (offset < 0) return null;
  identifier.lastIndex = offset;
  return identifier.exec(source)?.[0] ?? null;
}

/** Go whitespace and non-nesting comments separate the first two tokens. */
function skipGoTrivia(source: string, start: number): number {
  let offset = start;
  while (offset < source.length) {
    const code = source.charCodeAt(offset);
    if (code === 0x20 || code === 0x09 || code === 0x0d || code === 0x0a) {
      offset += 1;
    } else if (source.startsWith("//", offset)) {
      const end = source.indexOf("\n", offset + 2);
      offset = end < 0 ? source.length : end + 1;
    } else if (source.startsWith("/*", offset)) {
      const end = source.indexOf("*/", offset + 2);
      if (end < 0) return -1;
      offset = end + 2;
    } else break;
  }
  return offset;
}

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
 * Classification uses the first scanned regular non-test .go file yielding a
 * package-clause prefix. It does not validate full package syntax, build
 * constraints, ignored filename prefixes or platform suffixes; Go compilation
 * remains authoritative for actual buildability.
 *
 * @evidence contracts/common.md#principled-implementation Actual module discovery and the first accepted leading package-clause prefix determine executable versus linked classification independently of the diagnostic label. Comments, initial BOM and Unicode identifiers are recognized, but filename/prefix admission is not full Go package validation.
 * @evidence contracts/common.md#clear-and-simple-design Module discovery, directory admission and package parsing are separate owning operations; the private scanner reads immediate regular non-test .go candidates.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Classification invokes the real source resolver and native filesystem rather than a guessed kind or cached filename.
 * @evidence contracts/common.md#meaningful-documentation The headline explains native ownership and the Go module returned to the loader.
 *
 * @evidence contracts/portability.md#os-neutral-implementation The module resolver and native fs/path queries use caller-selected native spelling and regular-file metadata without blanket case folding or separator guessing. These preflight queries do not freeze physical identity or certify platform-specific Go build eligibility.
 * @evidence contracts/performance.md#efficient-algorithms After ancestor module discovery, the scanner visits immediate entries and reads candidate production Go files until it finds a package clause. Full immediate-directory materialization and candidate file reads/UTF-8 decoding scale with entry/path and file bytes; lexical scanning visits leading trivia and two identifiers without line arrays or recursive payload traversal. Ancestor path queries and label/property text handling remain part of the delegated cost.
 * @evidence contracts/performance.md#reuse-equivalent-work Classification reobserves the supplied source because its files and package declaration can change between loads; the label is selected once for this query and shared across its source/module diagnostics; no cross-load classification cache is established.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Directory entries and candidate file strings are invocation-local, growing with the immediate population and complete file sizes; returned classification/module strings transfer to the loader. Synchronous filesystem calls retain no source handle here, and no population ceiling or global classification history is owned.
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

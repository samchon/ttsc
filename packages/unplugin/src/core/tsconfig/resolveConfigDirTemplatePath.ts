import path from "node:path";

import { normalizeTypeScriptPathSeparators } from "./normalizeTypeScriptPathSeparators";
import { startsWithConfigDirTemplate } from "./startsWithConfigDirTemplate";

/**
 * Resolve one config path with TypeScript's leading configDir template.
 *
 * Template paths use the final consumer directory; ordinary paths use the
 * declaring directory. Config separators are normalized before native
 * resolution.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The compiler-compatible prefix predicate chooses the consumer anchor;
 *   native path.resolve handles absolute targets and leaves wildcard text intact.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One helper owns template substitution and anchoring for membership and
 *   generated-config readers, avoiding different policies at their call sites.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Compiler-language separators normalize before Node path.resolve interprets
 *   native roots and absolute targets; case-insensitive template spelling is
 *   language syntax, not a claim about directory name comparison.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The template is compiler-defined syntax, not a fixture path or wrapper
 *   added to conceal a wrong declaring-directory assumption.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native comment distinguishes declaring and consumer anchors and explains
 *   separator normalization, with the boundary prose separated from tags.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function resolveConfigDirTemplatePath(
  baseDir: string,
  target: string,
  configDir: string = baseDir,
): string {
  const template = "${configDir}";
  const normalized = normalizeTypeScriptPathSeparators(target);
  return startsWithConfigDirTemplate(normalized)
    ? path.resolve(configDir, normalized.replace(template, "./"))
    : path.resolve(baseDir, normalized);
}

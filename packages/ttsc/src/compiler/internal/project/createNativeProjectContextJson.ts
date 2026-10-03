import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";

/**
 * The identity payload itself, for a caller that spawns a sidecar without going
 * through the compiler's own argument list.
 *
 * Split from the flag so there is still exactly one place that decides what a
 * sidecar is told about the project. A second caller assembling the same JSON,
 * or slicing it back out of the flag, is how the two drift.
 *
 * @evidence contracts/common.md#principled-implementation JSON.stringify encodes the retained identity fields and includes pluginConfigOrigin only when explicitly provided, preserving the protocol's distinction between absent origin and an override.
 * @evidence contracts/common.md#clear-and-simple-design One payload serializer serves argument and environment consumers so project-context field selection cannot drift between independent assembly paths.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Identity comes from the resolved project record rather than reinterpreting paths from a generated wrapper or substituting a known consumer's project directory.
 * @evidence contracts/common.md#meaningful-documentation Purpose and ownership rationale occupy separate native paragraphs, with acknowledgments separated according to the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The serialized string is returned to the caller and nothing is retained.
 * @evidence contracts/performance.md#efficient-algorithms One shallow identity copy and JSON serialization preserve the selected fields; encoding time and returned text scale with identity string bytes, not just the fixed field count.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work One serialization per call from its arguments; nothing is shared.
 * @evidence contracts/portability.md#os-neutral-implementation JSON encoding preserves the supplied native path spellings, including separators and quoting characters, as structured protocol data without shell quoting, case folding or independent filesystem-identity certification.
 */
export function createNativeProjectContextJson(
  project: ITtscParsedProjectConfig,
  pluginConfigOrigin?: string,
): string {
  return JSON.stringify({
    ...project.identity,
    ...(pluginConfigOrigin === undefined ? {} : { pluginConfigOrigin }),
  });
}

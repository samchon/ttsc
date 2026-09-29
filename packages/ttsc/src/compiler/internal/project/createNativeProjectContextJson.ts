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

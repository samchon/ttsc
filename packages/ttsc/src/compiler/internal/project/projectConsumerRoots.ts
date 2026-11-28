import path from "node:path";

import type { ITtscProjectIdentity } from "../../../structures/internal/ITtscProjectIdentity";

/**
 * Carry the invocation, project and both config directories to scratch owners.
 * A config reached through a file alias can have a distinct physical
 * directory.
 *
 * @evidence contracts/common.md#principled-implementation The selected project identity supplies the invocation, project and both config boundaries.
 * @evidence contracts/common.md#clear-and-simple-design Command producers share one boundary list without repeating config selection.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The invocation cwd alone cannot stand in for an externally selected config.
 * @evidence contracts/common.md#meaningful-documentation Explains why both config directories are carried.
 * @evidence contracts/portability.md#os-neutral-implementation Native dirname extracts the physical config parent. Scratch owners qualify native identity before writing.
 * @evidence contracts/performance.md#efficient-algorithms The helper collects four path strings and drops equal spellings without native lookup.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The result reflects the caller's selected generation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No native resource or historical state is acquired.
 */
export function projectConsumerRoots(identity: ITtscProjectIdentity): string[] {
  return [
    ...new Set([
      identity.invocationCwd,
      identity.physicalProjectRoot,
      identity.logicalProjectRoot,
      path.dirname(identity.physicalConfigPath),
    ]),
  ];
}

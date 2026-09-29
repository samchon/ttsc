import path from "node:path";

import { ProjectInputWatchRules } from "./ProjectInputWatchRules";
import { WatchPaths } from "./WatchPaths";

/**
 * Return whether a project-input population transition can reshape a Program.
 *
 * JSON is data to a ProjectRule but may simultaneously be a `resolveJsonModule`
 * source. TypeScript and JavaScript paths can likewise overlap a project-input
 * declaration. Their creation or deletion therefore requires a cold Program
 * inside the existing resident process. A filename-less event cannot identify
 * the changed member and is conservatively invalidating whenever the population
 * moved.
 *
 * @evidence contracts/common.md#principled-implementation Added or removed emittable members and package.json content changes can alter compiler resolution; unlocalized population movement conservatively invalidates the resident Program.
 * @evidence contracts/common.md#clear-and-simple-design Package selection changes, equal membership and changed compiler-capable members are separate ordered decisions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The predicate inspects both populations instead of guessing the changed member from one named event.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain overlapping JSON/source populations and unnamed-event invalidation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native basename and extension APIs interpret paths; already canonical membership keys retain their producer's actual identity policy.
 * @evidence contracts/performance.md#efficient-algorithms At most one comparison and two linear membership passes visit P previous and N next entries, using existing map indexes and no reconstructed population.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This predicate classifies supplied snapshots without coordinating compilation reuse itself.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Both populations are borrowed and no historical state or native resource is retained.
 */
export function projectInputMembershipInvalidatesProgram(input: {
  changed?: string;
  changedInputs?: readonly string[];
  contentChanged?: boolean;
  next: ReadonlyMap<string, string>;
  previous: ReadonlyMap<string, string>;
}): boolean {
  if (
    input.contentChanged === true &&
    (
      input.changedInputs ??
      (input.changed === undefined ? [] : [input.changed])
    ).some(
      (location) => path.basename(location).toLowerCase() === "package.json",
    )
  ) {
    return true;
  }
  if (WatchPaths.mapsEqual(input.previous, input.next)) return false;
  if (input.changed === undefined) return true;
  for (const [key, location] of input.previous) {
    if (
      input.next.has(key) === false &&
      ProjectInputWatchRules.projectInputPathMayAffectProgram(location)
    ) {
      return true;
    }
  }
  for (const [key, location] of input.next) {
    if (
      input.previous.has(key) === false &&
      ProjectInputWatchRules.projectInputPathMayAffectProgram(location)
    ) {
      return true;
    }
  }
  return false;
}

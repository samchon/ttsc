import path from "node:path";
import { WatchPaths } from "./WatchPaths";
import { ProjectInputWatchRules } from "./ProjectInputWatchRules";

/**
 * Return whether a project-input population transition can reshape a Program.
 *
 * JSON is data to a ProjectRule but may simultaneously be a `resolveJsonModule`
 * source. TypeScript and JavaScript paths can likewise overlap a project-input
 * declaration. Their creation or deletion therefore requires a cold Program
 * inside the existing resident process. A filename-less event cannot identify
 * the changed member and is conservatively invalidating whenever the population
 * moved.
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

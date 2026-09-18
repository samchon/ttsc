import type { IRootPattern } from "./IRootPattern";
import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { compile } from "./compile";
import { matches } from "./matches";
import { rootSpellings } from "./rootSpellings";

const compiled = new WeakMap<ITtscProjectMembershipPolicy, IRootPattern[]>();

/**
 * Match configured root files or a directory that can contain one.
 *
 * This is discovery, not dependency membership: imports outside these specs
 * remain compiler inputs and are proven by the external-input snapshot.
 * TypeScript's include grammar has only *, ?, ** and implicit directory globs.
 * Unknown policies stay permissive; no filesystem existence probe is needed, so
 * a newly created directory receives the same answer as an existing one.
 */
export function matchesProjectRootFile(
  location: string,
  policy: ITtscProjectMembershipPolicy,
  directory: boolean,
): boolean {
  if (policy.rootFileSpecs === undefined) return true;
  let patterns = compiled.get(policy);
  if (patterns === undefined) {
    patterns = [
      ...policy.rootFileSpecs.files.map((spec) => compile(spec, true)),
      ...policy.rootFileSpecs.include.map((spec) => compile(spec, false)),
    ].filter((pattern): pattern is IRootPattern => pattern !== undefined);
    compiled.set(policy, patterns);
  }
  return rootSpellings(location, policy).some((spelling) => {
    const parts = spelling.replace(/\\/g, "/").split("/");
    return patterns.some((pattern) => matches(parts, pattern, directory));
  });
}

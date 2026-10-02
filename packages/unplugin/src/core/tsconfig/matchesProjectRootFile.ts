import type { IRootPattern } from "./IRootPattern";
import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { compile } from "./compile";
import { matches } from "./matches";
import { policyUsesCaseSensitiveFileNames } from "./policyUsesCaseSensitiveFileNames";
import { rootSpellings } from "./rootSpellings";

const compiled = new WeakMap<
  ITtscProjectMembershipPolicy,
  Map<NodeJS.Platform, IRootPattern[]>
>();

/**
 * Match configured root files or a directory that can contain one.
 *
 * This is discovery, not dependency membership: imports outside these specs
 * remain compiler inputs and are proven by the external-input snapshot.
 * TypeScript's include grammar has only *, ?, ** and implicit directory globs;
 * wildcards never enter package folders or hidden paths, a `.min.js` file needs
 * a wildcard that spells `.min.`, and a JSON file needs a literal entry or a
 * spec ending in `.json`. A policy whose configuration could not be read stays
 * permissive. No filesystem existence probe is needed, so a newly created
 * directory receives the same answer as an existing one. An explicit
 * filesystem-view platform controls path grammar independently of the policy's
 * compiler comparison rule.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Compiled files/include patterns match root selection, not imported
 *   dependencies. JSON admission and directory-prefix acceptance remain
 *   separate rules; an unreadable policy conservatively admits possible roots.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One entry point chooses relevant patterns and equivalent root spellings;
 *   compile owns grammar and matches owns the state transition algorithm.
 *
 *
 *
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Matching uses configured specs and the compiler's case answer, never a
 *   list of known application directories or filesystem-existence guesses.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs distinguish root discovery from dependencies and explain
 *   hidden/package/JSON rules plus the permissive unreadable-config boundary.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The provided filesystem-view platform reaches compilation and root alias
 *   conversion together; native callers default to the host, while foreign
 *   views never resolve their roots through the host's path grammar. Compiler
 *   case sensitivity remains policy data independent of that grammar.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The WeakMap does not keep discarded policies alive. Compiled patterns are
 *   retained while a caller retains their policy, with bytes driven by its specs.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Pattern compilation happens once per policy object and view platform. Each spelling checks
 *   at most the configured pattern count; matching uses bounded component
 *   states per path part rather than recursive wildcard expansion.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The WeakMap shares compiled patterns across queries of the same immutable
 *   policy and filesystem-view platform. Producers replace policies when configuration or compiler case
 *   answers change; mutating a retained policy violates that representation.
 */
export function matchesProjectRootFile(
  location: string,
  policy: ITtscProjectMembershipPolicy,
  directory: boolean,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (policy.rootFileSpecs === undefined) return true;
  let byPlatform = compiled.get(policy);
  if (byPlatform === undefined) {
    byPlatform = new Map();
    compiled.set(policy, byPlatform);
  }
  let patterns = byPlatform.get(platform);
  if (patterns === undefined) {
    const caseSensitive = policyUsesCaseSensitiveFileNames(policy);
    patterns = [
      ...policy.rootFileSpecs.files.map((spec) =>
        compile(spec, true, caseSensitive, platform),
      ),
      ...policy.rootFileSpecs.include.map((spec) =>
        compile(spec, false, caseSensitive, platform),
      ),
    ].filter((pattern): pattern is IRootPattern => pattern !== undefined);
    byPlatform.set(platform, patterns);
  }
  // A JSON file enters the program only through a literal entry or an include
  // spec that itself ends in `.json`; TypeScript-Go matches every other spec
  // against it and then discards the match. A directory can still hold one, so
  // it keeps every pattern.
  const json = !directory && location.toLowerCase().endsWith(".json");
  const candidates = json
    ? patterns.filter((pattern) => pattern.json)
    : patterns;
  if (candidates.length === 0) return false;
  return rootSpellings(
    location,
    policy,
    patterns[0]!.caseSensitive,
    platform,
  ).some((spelling) => {
    const parts = spelling.replace(/\\/g, "/").split("/");
    return candidates.some((pattern) => matches(parts, pattern, directory));
  });
}

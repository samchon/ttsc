import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { compile } from "./compile";
import { matches } from "./matches";
import { policyUsesCaseSensitiveFileNames } from "./policyUsesCaseSensitiveFileNames";

/**
 * The policy and the walk both spell the project root as it was named, while a
 * native watcher or package `extends` may use another observed root spelling.
 * Match each equivalent project-root spelling without following child links.
 * Keep patterns intact: a glob can begin above the root, and configDir can
 * retain the requested spelling even when a base config uses the physical one.
 * Observed root aliases do not establish how native events spell child names.
 *
 * Node's Windows relative-path operation ignores case. A containing spelling is
 * therefore checked under the compiler's comparison rule before conversion;
 * otherwise two case-distinct roots could be treated as the same project. The
 * filesystem view's platform supplies grammar when it differs from the host.
 *
 * @param caseSensitive An already selected compiler comparison rule. Omission
 *   resolves the policy's reported or predicted rule only when root aliases
 *   exist.
 * @evidence contracts/common.md#principled-implementation
 *   Replacing only a containing root spelling preserves the relative suffix
 *   and child-link semantics while matching regular/native aliases of that root.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns root representation conversion; the pattern compiler owns
 *   matching grammar and the policy carries observed root spellings.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Policy roots carry regular and native realpath spellings obtained by the
 *   producer. Explicit view platform selects win32/posix containment grammar
 *   and retains a relative suffix without following
 *   child links. Literal matching under the compiler's case rule verifies that
 *   native relative-path computation did not merge case-distinct roots.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   It uses supplied root aliases rather than inventing child realpaths or
 *   patching a native watch event to fit an expected project.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains lexical, physical and watcher spelling and why child
 *   links and above-root globs must retain their original meaning.
 * @evidence contracts/performance.md#efficient-algorithms
 *   At most three supplied root spellings are deduplicated and tested. Native
 *   relative/resolution, literal compilation and component matching follow
 *   their path lengths; the successful branch resolves one suffix under each
 *   alias. An omitted case answer retains the shared predictor's placement
 *   and native probe cost rather than becoming constant wrapper work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This one-location conversion coordinates no cross-query result sharing.
 *   Any provisional case-probe reuse belongs to the policy resolver; local
 *   root deduplication is not an equivalence cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The spellings Set is local to the call.
 */
export function rootSpellings(
  location: string,
  policy: ITtscProjectMembershipPolicy,
  caseSensitive?: boolean,
  platform: NodeJS.Platform = process.platform,
): string[] {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const resolved = paths.resolve(location);
  const root = policy.rootFileSpecs?.root;
  if (root === undefined) return [resolved];
  caseSensitive ??= policyUsesCaseSensitiveFileNames(policy);
  const spellings = [
    ...new Set([root.path, root.realpath, root.nativepath ?? root.realpath]),
  ];
  for (const spelling of spellings) {
    const relative = paths.relative(spelling, resolved);
    if (
      relative !== ".." &&
      !relative.startsWith(`..${paths.sep}`) &&
      !paths.isAbsolute(relative)
    ) {
      const reconstructed = compile(
        paths.resolve(spelling, relative),
        true,
        caseSensitive,
        platform,
      )!;
      if (
        matches(resolved.replace(/\\/g, "/").split("/"), reconstructed, false)
      )
        return spellings.map((candidate) => paths.resolve(candidate, relative));
    }
  }
  return [resolved];
}

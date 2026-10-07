import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { policyUsesCaseSensitiveFileNames } from "../../tsconfig/policyUsesCaseSensitiveFileNames";

/**
 * Whether a path lies inside a directory the configuration excludes.
 *
 * Lexical, exactly like the walk and like `isProjectWalkPath`, and for the
 * reason that predicate states: walk membership is lexical, so resolving a path
 * to physical identity first would collapse two spellings the walk keeps apart
 * and claim it covered a subtree it never followed. A junction whose target the
 * walk hashes under its own name is exactly that, and canonicalizing here would
 * suppress every event in it.
 *
 * `strictly` excludes an exact match, for the case where the excluded entry
 * names a file rather than a directory: `exclude` accepts one, the walk applies
 * exclusion to directories alone, so that file is still hashed and its events
 * must keep counting.
 *
 * Path resolution follows the supplied filesystem view, while component
 * equality follows the compiler's comparison policy. Neither Node's Windows
 * case-insensitive containment nor a POSIX case-sensitive comparison can
 * substitute for that independent policy. Literal components also retain
 * Unicode simple folding, without turning configured names into glob patterns.
 * Before a compiler report supplies the case answer, the existing prediction
 * owner may set up and observe its selected native compiler-cache root. This
 * predicate does not replace that owner's approximation or cache lifetime.
 *
 * @evidence contracts/common.md#principled-implementation Native lexical components compare configured excluded locations under the compiler's case policy without collapsing symlink spellings; strict mode exempts the exact entry under that same policy so directory-only exclusion does not misclassify a file.
 * @evidence contracts/common.md#clear-and-simple-design An empty-policy fast path and one literal-component prefix scan keep grammar selection, compiler comparison and strict exact-entry handling explicit.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exclusion follows actual configured locations rather than generic directory-name exceptions or physical normalization that erases unwalked aliases.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain lexical walk membership, exact-file exemption and why compiler comparison policy is independent of native path grammar.
 * @evidence contracts/portability.md#os-neutral-implementation Explicit view-platform Node resolution and native component separators retain root, drive and UNC boundaries; compiler-reported or predicted case policy governs exact and descendant comparison, including Unicode simple folding, without resolving links.
 * @evidence contracts/performance.md#efficient-algorithms Resolves and splits the queried path once, then short-circuits component prefixes across the configured exclusions. Cold compilation scans excluded path text and escapes literal components; warm component work follows exclusion component/text population, with query components temporary and no glob state expansion. A reported case flag is direct data; otherwise the prediction owner additionally performs native cache-root setup/observations and shares its physical-root answer under its documented assumptions.
 * @evidence contracts/performance.md#reuse-equivalent-work A WeakMap shares compiled absolute exclusion components for the same immutable policy, selected native grammar and current compiler case answer. Changed configuration replaces the policy; a changed predicted answer selects a separate entry rather than trusting an old comparison policy.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Weak policy keys do not retain discarded configurations. Each live policy retains at most two grammars times two case answers, with component strings/expressions driven by its exclusion text; per-query components expire on return and no native handle is acquired.
 */
export function insideExcludedProjectDirectory(
  location: string,
  policy: ITtscProjectMembershipPolicy,
  strictly: boolean,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (policy.excludedDirectories.length === 0) {
    return false;
  }
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const resolved = pathApi.resolve(location);
  const parts = (
    resolved.endsWith(pathApi.sep) ? resolved.slice(0, -1) : resolved
  ).split(pathApi.sep);
  const caseSensitive = policyUsesCaseSensitiveFileNames(policy);
  const key = `${platform === "win32" ? "win32" : "posix"}:${caseSensitive}`;
  let byComparison = compiled.get(policy);
  if (byComparison === undefined) {
    byComparison = new Map();
    compiled.set(policy, byComparison);
  }
  let patterns = byComparison.get(key);
  if (patterns === undefined) {
    patterns = policy.excludedDirectories.map((excluded) => {
      const target = pathApi.resolve(excluded);
      return (target.endsWith(pathApi.sep) ? target.slice(0, -1) : target)
        .split(pathApi.sep)
        .map((part) =>
          caseSensitive
            ? part
            : new RegExp(
                `^${part.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}(?![\\s\\S])`,
                "iu",
              ),
        );
    });
    byComparison.set(key, patterns);
  }
  return patterns.some((components) => {
    if (
      components.length > parts.length ||
      (strictly && components.length === parts.length)
    )
      return false;
    return components.every((component, index) =>
      typeof component === "string"
        ? component === parts[index]
        : component.test(parts[index]!),
    );
  });
}

/** Literal exclusion components owned weakly by immutable membership policy. */
const compiled = new WeakMap<
  ITtscProjectMembershipPolicy,
  Map<string, readonly (readonly (string | RegExp)[])[]>
>();

import fs from "node:fs";
import path from "node:path";

import type { ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import { isFilesystemPathIdentityWithin } from "../../../internal/pathIdentity/isFilesystemPathIdentityWithin";

/**
 * Path helpers the watch topology calls per event.
 *
 * Containment and membership preserve lexical declarations rather than merge
 * symlink aliases. Their supplied transaction shares native parent-directory
 * case observations; map equality needs no filesystem query. Directory probes
 * use one `stat` per candidate and follow native links.
 *
 * @evidence contracts/common.md#principled-implementation Lexical containment and membership stay distinct from physical-identity operations; directory predicates ask the native filesystem rather than infer kind from spelling.
 * @evidence contracts/common.md#clear-and-simple-design One namespace groups event-time lexical calculations and the two directory probes, separate from transaction identity resolution.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts These helpers do not reread content to fabricate a compiler input state or mutate native filesystem methods.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain lexical-versus-physical scope and directory probing following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path APIs handle separator/volume arithmetic; parent-directory case observations qualify lexical key folding without collapsing physical aliases or assuming an OS-wide case policy.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms Namespace membership itself performs no computation; individual helpers own their algorithms.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace defines no shared computation coordinator.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Helpers retain no namespace-level cache or native handles.
 */
export namespace WatchPaths {
  /**
   * Whether `location` exists and is a directory, following links.
   *
   * @evidence contracts/common.md#principled-implementation A successful native stat determines directory kind; an unavailable stat remains false rather than inventing an accessible directory.
   * @evidence contracts/common.md#clear-and-simple-design One stat and failure boundary provide the admission predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Filesystem state replaces extension/name heuristics and no native stat method is patched.
   * @evidence contracts/common.md#meaningful-documentation Native prose states existence, kind and followed-link semantics following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Node stat owns native link following and directory semantics without an OS-name-derived file-kind rule.
   *
   * @evidence contracts/performance.md#efficient-algorithms One synchronous native stat plus kind inspection performs no collection traversal here. Work includes supplied path processing and native metadata/target lookup; a single boolean result does not cap those costs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A fresh stat serves the event's current native state rather than a historical result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The stat result is local with no retained handle or history.
   */
  export function isDirectory(location: string): boolean {
    try {
      return fs.statSync(location).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * The nearest lexical ancestor at or above `location` successfully observed
   * as a directory, or undefined when none is admitted, including the volume
   * root. Native query failure is not proof that an ancestor does not exist.
   *
   * @evidence contracts/common.md#principled-implementation Walking native parents finds the deepest directory admitted by stat; root equality ends an unsuccessful search without equating query failure with proven absence.
   * @evidence contracts/common.md#clear-and-simple-design One ancestor loop reuses the directory predicate without a second search policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The answer derives from actual ancestor state instead of assumed temporary or project layouts.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains the missing-input anchor and undefined result following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Node resolve/dirname preserve native volume roots and stat provides actual accessibility/kind.
   * @evidence contracts/performance.md#efficient-algorithms At most D lexical ancestors each require a native stat, while repeated resolve/dirname and native lookup process their spelling lengths. Current-path storage is local; ancestor depth/path text are not capped here and descendant contents are not enumerated.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Event-time ancestor state may change; this helper owns no cross-request cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources One current path remains local and no watcher or resident index is acquired.
   */
  export function nearestExistingDirectory(
    location: string,
  ): string | undefined {
    let current = path.resolve(location);
    while (true) {
      if (isDirectory(current)) return current;
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }

  /**
   * Whether two key-to-path maps hold exactly the same entries.
   *
   * @evidence contracts/common.md#principled-implementation Equal cardinality plus equal values at every left key establishes equality of the complete keyed population.
   * @evidence contracts/common.md#clear-and-simple-design One size guard precedes a direct iterator comparison.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Equality uses supplied entries rather than assuming insertion order or accepting equal key counts alone.
   * @evidence contracts/common.md#meaningful-documentation Native prose specifies exact key-to-path equality following the documentation skill.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This comparison borrows already keyed maps and performs no native path operation.
   *
   * @evidence contracts/performance.md#efficient-algorithms A size mismatch returns immediately; otherwise at most N borrowed entries require indexed key lookup and string-value equality. Work includes key/value spelling comparisons as well as map indexing; auxiliary iteration state is constant without an intermediate population array, and N/text lengths are not capped here.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Map comparison owns no completed/in-flight computation sharing.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Both maps are borrowed and no entries survive the call in helper-owned state.
   */
  export function mapsEqual(
    left: ReadonlyMap<string, string>,
    right: ReadonlyMap<string, string>,
  ): boolean {
    if (left.size !== right.size) return false;
    for (const [key, value] of left) {
      if (right.get(key) !== value) return false;
    }
    return true;
  }

  /**
   * Whether `candidate` is `root` or lies beneath it, compared lexically.
   *
   * @evidence contracts/common.md#principled-implementation Equal lexical keys include the root; separator-delimited descendants preserve proved component case semantics and reject siblings or distinct volumes.
   * @evidence contracts/common.md#clear-and-simple-design Shared key construction precedes the existing canonical-key containment predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A sibling whose name begins with the root is not accepted by a prefix shortcut.
   * @evidence contracts/common.md#meaningful-documentation Native prose limits this predicate to lexical containment following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native lexical keys fold only proved insensitive components, preserve unknown spelling and retain drive/UNC/POSIX grammar without Windows relative-path case folding.
   * @evidence contracts/performance.md#efficient-algorithms Two delegated component-key constructions precede one separator-prefix comparison. Work includes spelling/ancestor/entry observations and possible synchronous case-query processes, plus key text comparison; no descendant corpus is enumerated and those populations are not capped here.
   * @evidence contracts/performance.md#reuse-equivalent-work The supplied transaction shares parent-directory capability observations with sibling key and containment requests; standalone calls create fresh observations.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate borrows the transaction or creates invocation-local caches and acquires no watcher or persistent history.
   */
  export function isPathWithin(
    root: string,
    candidate: string,
    identities = createProjectInputPathIdentityContext({
      throwOnRealpathError: false,
    }),
  ): boolean {
    return isFilesystemPathIdentityWithin(
      identities.lexicalKey(root),
      identities.lexicalKey(candidate),
    );
  }

  /**
   * The lexical watch key for `location`, preserving declaration aliases.
   * Under proved insensitive parents, ASCII letters in each component are
   * folded; non-ASCII component characters remain unchanged. Sensitive or
   * unknown parents preserve component spelling. Native volume-root formatting
   * remains the shared resolver's separate rule.
   *
   * @evidence contracts/common.md#principled-implementation The shared component key folds only native evidence of insensitive parents, so sensitive and unknown names remain distinct while lexical symlink ownership is preserved.
   * @evidence contracts/common.md#clear-and-simple-design One delegation uses the transaction's lexical policy without duplicating physical resolution or native probing.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An OS name never supplies case evidence, and physical realpath keys do not replace declarations merely to normalize aliases.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes lexical ownership, proved folding and unknown spelling following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation The shared resolver applies native root grammar and actual parent-directory capability; Windows sensitive directories and POSIX insensitive volumes follow their measured policy.
   *
   * @evidence contracts/performance.md#efficient-algorithms The delegated lexical resolver walks path components and observes parent identities/case authority, potentially including native ancestor/entry work and synchronous Windows queries. Path/name/output text and visited populations are uncapped here; returning one key does not make delegation constant-cost.
   *
   * @evidence contracts/performance.md#reuse-equivalent-work Callers share one transaction across reconciliation keys; omitted contexts start fresh capability observations rather than reuse historical generations.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Borrowed transaction ownership stays with the caller; a standalone context becomes unreachable on return and no watcher is acquired.
   */
  export function pathKey(
    location: string,
    identities: ProjectInputPathIdentityContext = createProjectInputPathIdentityContext(
      {
        throwOnRealpathError: false,
      },
    ),
  ): string {
    return identities.lexicalKey(location);
  }
}

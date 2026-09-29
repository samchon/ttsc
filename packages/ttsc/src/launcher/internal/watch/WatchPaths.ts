import fs from "node:fs";
import path from "node:path";

import type { ProjectInputPathIdentityContext } from "../../../internal/pathIdentity/ProjectInputPathIdentityContext";
import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";
import { isFilesystemPathIdentityWithin } from "../../../internal/pathIdentity/isFilesystemPathIdentityWithin";

/**
 * Cheap path helpers the watch topology calls per event.
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
   * @evidenceExclude contracts/performance.md#efficient-algorithms The standard native stat owns one path query; this adapter selects no collection algorithm.
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
   * The closest existing directory at or above `location`, or `undefined` when
   * not even the volume root exists. Watching a missing input starts here.
   *
   * @evidence contracts/common.md#principled-implementation Walking native parents finds the deepest existing directory, and root equality proves termination when none exists.
   * @evidence contracts/common.md#clear-and-simple-design One ancestor loop reuses the directory predicate without a second search policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The answer derives from actual ancestor state instead of assumed temporary or project layouts.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains the missing-input anchor and undefined result following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Node resolve/dirname preserve native volume roots and stat provides actual accessibility/kind.
   * @evidence contracts/performance.md#efficient-algorithms At most D ancestors require D native stats; only the current path is retained, without enumerating descendant contents.
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
   * @evidence contracts/performance.md#efficient-algorithms N entries need at most N indexed lookups and constant auxiliary space, without materializing an intermediate entry array.
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
   * @evidence contracts/performance.md#efficient-algorithms Two component-key constructions and one separator-prefix comparison scale with path depth and spelling length without enumerating descendants.
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
   * The lexical watch key for `location`, preserving declaration aliases. Only
   * ASCII components under proved insensitive parents are folded. Sensitive,
   * unknown or native Unicode names retain their spelling rather than merge
   * inputs through an unproved identity relation.
   *
   * @evidence contracts/common.md#principled-implementation The shared component key folds only native evidence of insensitive parents, so sensitive and unknown names remain distinct while lexical symlink ownership is preserved.
   * @evidence contracts/common.md#clear-and-simple-design One delegation uses the transaction's lexical policy without duplicating physical resolution or native probing.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An OS name never supplies case evidence, and physical realpath keys do not replace declarations merely to normalize aliases.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes lexical ownership, proved folding and unknown spelling following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation The shared resolver applies native root grammar and actual parent-directory capability; Windows sensitive directories and POSIX insensitive volumes follow their measured policy.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms The owning lexical resolver selects component traversal; this wrapper only delegates.
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

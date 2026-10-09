import fs from "node:fs";
import path from "node:path";

import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * Physical installed-source and owning-project authority for runtime loading.
 *
 * @evidence contracts/common.md#principled-implementation A shared native installed-directory predicate governs both project traversal and whether a source root belongs to the user. Physical workspace paths retain their own authority.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns the related decisions and nearest-config cache; compiler module-format precedence remains a separate owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native physical identity proves alternate installed spellings without OS-wide case folding, consumer exceptions or foreign filesystem replacement.
 * @evidence contracts/common.md#meaningful-documentation Public method prose states physical-path preconditions, nearest own-config priority and current cache validation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The namespace groups operations; each method documents native path and filesystem authority.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups operations; methods choose their algorithms.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Cache validity belongs to nearestTsconfig.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Cache retention belongs to nearestTsconfig.
 */
export namespace RuntimeProjectOwnership {
  interface Lookup {
    candidates: readonly string[];
    result: string | null;
    boundary?: string;
  }
  const cache = new Map<string, Lookup>();

  /**
   * Whether a physical source path passes through an installed directory.
   * A linked workspace physically outside that directory remains user source.
   * Alternate spellings count only when the native lowercase installed spelling
   * resolves to the same physical directory; failed identity reads prove none.
   *
   * @evidence contracts/common.md#principled-implementation Native dirname traversal applies the same installed-directory identity used by config lookup. Source callers have already resolved links, so installed links to outside workspace targets do not transfer package authority.
   * @evidence contracts/common.md#clear-and-simple-design One ancestor walk delegates the installed spelling decision to the shared private predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A lowercase candidate routes a native identity query; it never establishes case equivalence on its own. No runtime source or root gate is bypassed.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs identify the physical-source precondition, workspace behavior and failed identity boundary.
   * @evidence contracts/portability.md#os-neutral-implementation Native path.dirname preserves platform separators and POSIX backslashes as filename data. realpathSync.native proves actual aliasing without an OS-name casing policy.
   * @evidence contracts/performance.md#efficient-algorithms The walk visits path ancestors and only possible alternate installed basenames incur two native identity reads. Depth and native resolution cost are input-dependent.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Mutable native alias topology is observed for each call rather than retained as a platform capability.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous walk retains no handles or historical identities.
   */
  export function isInstalledPackageSource(real: string): boolean {
    for (let directory = path.dirname(real);;) {
      if (isInstalledDirectory(directory)) return true;
      const parent = path.dirname(directory);
      if (parent === directory) return false;
      directory = parent;
    }
  }

  /**
   * The nearest own tsconfig above a physical source, stopping before the
   * consumer across an installed directory. A package's nearer config wins.
   *
   * Cached walks recheck both candidate files and the native boundary topology.
   * Creating/deleting a config or adding/removing an installed alias therefore
   * cannot retain an earlier consumer or isolated selection. The observer
   * brackets config candidates and alternate directory identities for descriptor
   * dependency recording; it does not pin the filesystem during compilation.
   *
   * @evidence contracts/common.md#principled-implementation Upward traversal selects the first existing config before the installed boundary. Cache entries retain ordered candidates and their stopping boundary; current candidate and native topology checks establish whether the old selection still applies.
   * @evidence contracts/common.md#clear-and-simple-design The same private predicate serves fresh lookup, cached topology validation and installed-source classification. One directory-keyed cache shares the walked suffix without a second casing policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Native file kind and physical alias identity determine selection. Cache invalidation corrects changed inputs directly without caller-specific retries, source gating bypasses or foreign mutation.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs state nearer package-config priority, physical source authority, topology invalidation and the observer's limits.
   * @evidence contracts/portability.md#os-neutral-implementation path.dirname/join and native realpath/stat preserve actual directory spelling and physical links. Alternate spelling succeeds only through observed native aliasing on that filesystem.
   * @evidence contracts/performance.md#efficient-algorithms Fresh lookup walks ancestors and stats each candidate until selection or boundary. Warm lookup rechecks its ordered candidates and possible installed-boundary identities; storing candidate suffix arrays can retain quadratic references over a deep newly walked chain, as with the existing cache representation.
   * @evidence contracts/performance.md#reuse-equivalent-work Directory entries share equivalent suffix walks only while current nearest candidate and stopping-boundary topology agree. Descriptor observations bracket cached candidate liveness and native alias comparisons; no cross-process cache authority is inferred.
   * @evidence contracts/performance.md#bound-retention-and-release-resources This module-lifetime cache retains one entry per observed directory with no explicit capacity or eviction beyond invalidated entries. Queries retain no native handle/task; the runtime process owns cache lifetime and descriptor recording resources.
   */
  export function nearestTsconfig(
    file: string,
    observe: (candidates: readonly string[]) => void = () => {},
  ): string | null {
    let directory = path.dirname(file);
    const chain: string[] = [];
    for (;;) {
      if (isInstalledDirectory(directory, observe))
        return remember(chain, null, [], directory);
      const cached = cache.get(directory);
      if (cached !== undefined) {
        observe(cached.candidates);
        const topologyCurrent =
          (cached.boundary === undefined || isInstalledDirectory(cached.boundary, observe)) &&
          cached.candidates.every((candidate) => !isInstalledDirectory(path.dirname(candidate), observe));
        const current = nearestExisting(cached.candidates);
        observe(cached.candidates);
        if (topologyCurrent && current === cached.result)
          return remember(chain, cached.result, cached.candidates, cached.boundary);
        cache.delete(directory);
      }
      chain.push(directory);
      const candidate = path.join(directory, "tsconfig.json");
      observe([candidate]);
      if (RuntimeFilesystem.isFile(candidate)) return remember(chain, candidate);
      const parent = path.dirname(directory);
      if (parent === directory) return remember(chain, null);
      directory = parent;
    }
  }

  function isInstalledDirectory(
    directory: string,
    observe: (inputs: readonly string[]) => void = () => {},
  ): boolean {
    const basename = path.basename(directory);
    if (basename === "node_modules") return true;
    if (basename.toLowerCase() !== "node_modules") return false;
    const lowercase = path.join(path.dirname(directory), "node_modules");
    const inputs = [directory, lowercase];
    observe(inputs);
    try {
      return fs.realpathSync.native(directory) === fs.realpathSync.native(lowercase);
    } catch {
      return false;
    } finally {
      observe(inputs);
    }
  }

  function nearestExisting(candidates: readonly string[]): string | null {
    for (const candidate of candidates)
      if (RuntimeFilesystem.isFile(candidate)) return path.resolve(candidate);
    return null;
  }

  function remember(
    directories: readonly string[],
    result: string | null,
    tail: readonly string[] = [],
    boundary?: string,
  ): string | null {
    let candidates = [...tail];
    for (let index = directories.length - 1; index >= 0; --index) {
      const directory = directories[index]!;
      candidates = [path.join(directory, "tsconfig.json"), ...candidates];
      cache.set(directory, { candidates, result, boundary });
    }
    return result;
  }
}

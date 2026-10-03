import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolvePhysicalPath as resolvePhysicalPathIdentity } from "../../../internal/pathIdentity/resolvePhysicalPath";
import type { OwningModuleOptions } from "./OwningModuleOptions";

/**
 * Generations of the ttsx dependency cache: immutable emit directories and the
 * marker that publishes one of them.
 *
 * Under cooperative cache ownership and noncolliding generation ids, a build
 * writes a fresh `gen-<id>` directory before swapping the marker. Successful
 * publication pairs one marker with that build's emit; immutable generation
 * retention and stable native layout remain caller premises, not a guarantee
 * against external deletion, mutation or crash durability failure.
 *
 * @evidence contracts/common.md#principled-implementation Fresh generation directories and a generation-bearing marker bind one successful publication to its build under cooperative ownership and noncolliding ids, avoiding in-place reader generation replacement under those premises.
 * @evidence contracts/common.md#clear-and-simple-design The namespace groups the built-project record, marker representation and generation filesystem helpers around one publication concern.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Generation identity and real emit presence replace in-place shared writes; no consumer name or expected output certifies a completed build.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish publication from immutable-retention and native-layout premises; record members explain source-root context, output records and format options without property tags.
 * @evidence contracts/portability.md#os-neutral-implementation Native path joins and fs queries preserve host paths; the shared physical-identity resolver handles links and filesystem case capabilities without deriving them from the OS label.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This namespace defines publication helpers and records; algorithm choices belong to its individual operations and the producer.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This grouping owns no build-request cache; the generation marker and build coordinator determine when completed emit can be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no historical generation index; the dependency container owner reclaims emitted directories.
 */
export namespace DependencyBuildGeneration {
  /**
   * One built dependency project, as the runtime serves files from it.
   *
   * @evidence contracts/common.md#principled-implementation Emit directory, producer output-to-source observations, source-root context and format pair represent one built generation; the structural record is not a completion certificate and the output list alone cannot reconstruct program membership.
   * @evidence contracts/common.md#clear-and-simple-design Required members represent a usable build result without mixing completion-marker identity or acquisition state into serving metadata.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit output ownership and owning format options avoid guessing a compiled file from its basename or authored syntax.
   * @evidence contracts/common.md#meaningful-documentation The native purpose and spaced member comments distinguish generation location, best-effort source-root identity, output spelling and format selection without authenticating supplied fields.
   * @evidence contracts/portability.md#os-neutral-implementation emitDir and rootDir are native filesystem paths; root resolution may retain best-effort spelling on observation failure. Outputs are relative records, while emittedSources and refusal records use producer native output keys; the output index owns their conversion and membership checks.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms This build-result interface chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The data record carries identity inputs but does not coordinate build requests or establish invalidation by itself.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The record does not independently own the generation directory's lifetime.
   */
  export interface BuiltProject {
    /** The generation directory holding the project's emitted JavaScript. */
    emitDir: string;

    /** Source-root context, physically resolved when observable, with best-effort fallback spelling. */
    rootDir: string;

    /** The build's record of its outputs, relative to `emitDir`. */
    outputs: readonly string[];

    /** Actual absolute output-to-source observations from this compiler emit. */
    emittedSources: Readonly<Record<string, readonly string[]>>;

    /** Actual producer proof refusals, retained solely for diagnostics. */
    emittedSourceProofFailures?: Readonly<Record<string, string>>;

    /** The project's `module` and `target`, deciding each file's format. */
    moduleOptions: OwningModuleOptions;
  }

  /**
   * On-disk completion marker for a built dependency, shared across processes.
   *
   * `generation` names the exact immutable emit directory this marker describes
   * (`<cacheDir>/gen-<generation>`). The producer writes the marker after emit
   * presence and provenance checks, using a same-directory temporary file and
   * rename. Successful replacement publishes one whole marker under supported
   * native rename semantics; retained immutable generations and stable layout
   * remain cooperative premises. Parsing this structural record alone does
   * not prove current artifact presence, compiler success or crash durability.
   *
   * @evidence contracts/common.md#principled-implementation The generation names the immutable directory described by format and actual emit provenance; optional historical fields remain decodable but the current reader rejects their absence rather than inventing program membership from output names.
   * @evidence contracts/common.md#clear-and-simple-design One completion record contains publication identity and serving metadata, leaving pid ownership and lock state to their separate records.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The marker binds a real completed generation rather than pairing old metadata with whatever mutable directory currently exists.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish successful marker publication from artifact retention and completion authentication, and separately document historical-field absence without member acknowledgments.
   * @evidence contracts/portability.md#os-neutral-implementation The marker carries native source-root spelling, producer native output keys and relative output names. Root resolution can fall back to best-effort spelling; hexadecimal generation basenames are joined by the reader, while native marker replacement and artifact validation belong to producer and consumer.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms This serialized metadata interface defines values rather than a computation strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A record names one publication; the reader and build coordinator establish when other requests may reuse it.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Completion metadata does not independently acquire or release the generation directory.
   */
  export interface DependencyCacheMeta {
    /** The 128-bit hex id of the published generation directory. */
    generation: string;

    /** Source-root context with physical resolution when observable and best-effort fallback otherwise. */
    rootDir: string;

    /**
     * The project's emit-format options. Always written; a marker without it
     * predates the field and is rebuilt rather than guessed.
     */
    moduleOptions?: OwningModuleOptions;

    /**
     * The build's record of the JavaScript it emitted, relative to the
     * generation directory. Always written; a marker without it predates the
     * field and is rebuilt. Actual source ownership additionally requires
     * emittedSources from the compiler's completed write observations.
     */
    outputs?: readonly string[];

    /** Actual emit provenance; historical absence requires a fresh build. */
    emittedSources?: Readonly<Record<string, readonly string[]>>;

    /** Optional refusal context from this generation, without ownership proof. */
    emittedSourceProofFailures?: Readonly<Record<string, string>>;
  }

  /**
   * The immutable emit directory of one build generation under `cacheDir`.
   * Callers supply a generated or validated generation identifier.
   *
   * @evidence contracts/common.md#principled-implementation Prefixing a validated hex generation with gen- maps one publication identity to its immutable directory beneath the owning cache.
   * @evidence contracts/common.md#clear-and-simple-design One path constructor keeps the writer and reader's generation layout identical.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The layout follows the generation protocol and does not special-case a project or expected emit location.
   * @evidence contracts/common.md#meaningful-documentation Native prose states immutable location and the caller's identifier-validation responsibility.
   * @evidence contracts/portability.md#os-neutral-implementation path.join constructs the host-native child path; generation hex contains no native separator or drive syntax.
   * @evidence contracts/performance.md#efficient-algorithms Joining two path components costs their character lengths without filesystem traversal.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This deterministic spelling helper owns no request coordinator or completed build cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned path acquires no directory or handle.
   */
  export function dependencyGenerationDir(
    cacheDir: string,
    generation: string,
  ): string {
    return path.join(cacheDir, `gen-${generation}`);
  }

  /**
   * A fresh random 128-bit build-generation identifier, encoded as lowercase
   * hex.
   *
   * @evidence contracts/common.md#principled-implementation Sixteen cryptographically random bytes supply a probabilistically distinct generation identity compatible with the lock and emit basename validators.
   * @evidence contracts/common.md#clear-and-simple-design One generator supplies the same fixed representation to build publication and lock fencing.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Random generation identity avoids recycled pid or fixture-derived identity substitutions.
   * @evidence contracts/common.md#meaningful-documentation Native prose states randomness, bit width and lowercase hex encoding without claiming guaranteed uniqueness.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This fixed byte-to-hex calculation carries no native filesystem or process representation.
   *
   * @evidence contracts/performance.md#efficient-algorithms One 16-byte native cryptographic draw and hex encoding have fixed output size; native entropy latency or failure is not bounded by that byte count. No generation history is scanned.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every acquisition needs a new identity; reusing a prior draw would violate the generation premise.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The call returns a small identifier and retains no random buffer or native handle.
   */
  export function newDependencyGeneration(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * True for a well-formed lowercase 128-bit hex build generation. This
   * validates representation, not ownership or publication completion.
   *
   * @evidence contracts/common.md#principled-implementation A string guard and anchored 32-hex pattern enforce the generation representation before an untrusted marker becomes a directory component.
   * @evidence contracts/common.md#clear-and-simple-design One type predicate shares exact syntax between marker reads and retirement without conflating syntax with ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The validator recognizes the protocol grammar rather than known generation values or fixture identifiers.
   * @evidence contracts/common.md#meaningful-documentation Native prose states lowercase width and the limits of representation validation.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Hex grammar is platform-independent and performs no native path or process operation.
   *
   * @evidence contracts/performance.md#efficient-algorithms The anchored bounded repetition examines at most the fixed accepted width plus rejection boundary, with no unbounded backtracking.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A fixed-size syntax predicate supplies no expensive equivalent-request coordinator.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate retains no input history or resource.
   */
  export function isDependencyGeneration(value: unknown): value is string {
    return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
  }

  /**
   * Resolve build-root metadata through the runtime's shared native identity
   * owner.
   *
   * Existing roots use physical spelling. Missing paths use the surviving
   * ancestor's observed case policy; failed identity observation retains a
   * best-effort spelling so completed-build metadata remains usable.
   *
   * This root is build context, not proof of emitted source membership or
   * recursive-cleanup authority. Exact ownership uses the compiler's captured
   * emittedSources observations instead.
   *
   * @evidence contracts/common.md#principled-implementation Delegating to the launcher's shared filesystem-identity resolver aligns existing roots and its best-effort unresolved-tail rule with the served source spelling; unresolved fallback is not proof of deletion authority.
   * @evidence contracts/common.md#clear-and-simple-design The adapter keeps runtime build metadata on the same identity policy instead of implementing another case or link resolver.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Filesystem observations establish identity; no OS-name lowercasing or source-name exception substitutes for the shared resolver.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish root metadata from actual emitted-source proof and deletion authority, explaining physical resolution and its best-effort fallback.
   * @evidence contracts/portability.md#os-neutral-implementation The shared resolver observes native links and surviving-ancestor case capabilities; this adapter preserves the returned native spelling.
   * @evidence contracts/performance.md#efficient-algorithms Delegation creates a fresh identity context; path text and ancestor observations grow its maps, and native case observations may scan directory entries or invoke a Windows query. Fixed adapter steps do not bound that native work, and emitted source trees are not traversed by this adapter.
   * @evidence contracts/performance.md#reuse-equivalent-work The delegated context shares equivalent path and case observations within this invocation, then later invocations observe current filesystem state again. This adapter adds no historical identity cache or independent validity proof.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The delegated context owns call-local path/ancestor/case maps and native observations, including a possible Windows case-query child. Only the resulting string escapes after success or caught failure; the adapter holds no historical registry or directory handle.
   */
  export function resolvePhysicalPath(location: string): string {
    return resolvePhysicalPathIdentity(location);
  }

  /**
   * True when `directory` holds at least one emitted JavaScript file (any
   * depth).
   *
   * @evidence contracts/common.md#principled-implementation Directory traversal accepts only real regular-file JavaScript extensions and descends directory entries without following symlink leaves; failed reads cannot establish a completed emit.
   * @evidence contracts/common.md#clear-and-simple-design One existential tree predicate stops on the first qualifying file and leaves output ownership indexing to the separate build record.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The predicate observes actual emit presence rather than a marker's claim or a known filename, without treating a partial generation as published.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines JavaScript presence at any depth; the completion reader separately documents why presence alone does not establish ownership.
   * @evidence contracts/portability.md#os-neutral-implementation Native Dirent classification and path joins preserve host filesystem semantics; suffix grammar describes JavaScript outputs rather than host case policy.
   * @evidence contracts/performance.md#efficient-algorithms An early-exit depth-first walk visits at most E entries, with path joins and suffix tests also processing directory/name text and native listing costs. Temporary space includes all listings retained along the active recursion path, constructed path strings and depth D; it does not allocate a flattened tree.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The caller determines immutable generation publication; this predicate does not cache a result while a build may still be writing.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous directory reads retain no handle or history; generation storage belongs to its cache container.
   */
  export function emittedAnything(directory: string): boolean {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (emittedAnything(full)) {
          return true;
        }
      } else if (entry.isFile() && /\.(?:[cm]?js)$/i.test(entry.name)) {
        return true;
      }
    }
    return false;
  }
}

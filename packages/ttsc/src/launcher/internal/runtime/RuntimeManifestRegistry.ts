import fs from "node:fs";

import { EmitOwnershipIndex } from "../../../compiler/internal/EmitOwnershipIndex";
import { RuntimeEmitProvenance } from "./RuntimeEmitProvenance";
import type { RuntimeManifest } from "./RuntimeManifest";
import { realPath } from "./realPath";

/**
 * Every checked entry emit this runtime may serve from, and the lookup that
 * decides which of them owns a source file.
 *
 * A direct ttsx child inherits one manifest through `TTSX_RUNTIME_MANIFEST`;
 * `ttsc/register` adds one per root it prepares. The inherited manifest is read
 * lazily, once per process.
 *
 * An inherited manifest without actual emit provenance cannot be recovered from
 * this process's unknown preparation inputs and is rejected explicitly.
 * Registered callback results are copied on admission; caller mutation cannot
 * replace the build metadata associated with an already-created ownership
 * index.
 *
 * @evidence contracts/common.md#principled-implementation Inherited and registered manifests preserve preparation order; ownership indexes use actual compiler output-to-source observations, and an inherited build without valid provenance is rejected instead of inventing ownership from filenames.
 * @evidence contracts/common.md#clear-and-simple-design One registry owns admission snapshots, environment decoding and build-to-source lookup; each manifest delegates output identity to EmitOwnershipIndex instead of duplicating reverse mapping in hooks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ownership follows recorded builds and filesystem identity, not basename guesses or a fallback to unchecked source execution.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain inherited versus discovered roots, caller-independent admission, lookup precedence and immutable-build index reuse; members remain separately documented without property tags.
 * @evidence contracts/portability.md#os-neutral-implementation Native fs reads and the shared real-path resolver feed EmitOwnershipIndex's filesystem identity boundary; protocol output separators remain manifest data rather than native case assumptions.
 * @evidence contracts/performance.md#efficient-algorithms Lookup scans M manifests in ownership order and delegates each output lookup to its per-build index; environment JSON is decoded once rather than per import.
 * @evidence contracts/performance.md#reuse-equivalent-work Each admitted build has an owned frozen metadata snapshot and one WeakMap index; the ordered manifest view is shared until another admission invalidates it, while newly prepared roots receive distinct snapshots and indexes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The process retains its inherited snapshot and every registered root until exit; registered roots and their lookup state grow with discovered projects, with no eviction while imports may still need their checked emits.
 */
export namespace RuntimeManifestRegistry {
  let environmentManifestCache: RuntimeManifest | null | undefined;

  /**
   * Manifests of the roots this process prepared itself, in preparation order.
   * Only registerManifest appends owned snapshots; nothing removes from it.
   */
  const registeredManifests: RuntimeManifest[] = [];

  let manifestView: readonly RuntimeManifest[] | undefined;

  /**
   * Admit one checked preparation in order, detached from its caller's object.
   * The registry copies and freezes the metadata, output names and source
   * associations without freezing the caller's values. Later caller mutation
   * cannot change the build served by an existing ownership index.
   *
   * Invalid metadata throws before admission; this function neither builds the
   * project nor proves that its producer's source observations are
   * trustworthy.
   *
   * @evidence contracts/common.md#principled-implementation Admission validates the manifest grammar and captures all serving metadata, output names, format options and source arrays as owned frozen values, so a cached index cannot be paired with a later caller replacement.
   * @evidence contracts/common.md#clear-and-simple-design One explicit admission operation owns the transfer from a callback result to stable registry metadata; index construction and actual producer observation remain with their existing owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only owned copies are frozen; neither a foreign object mutation nor a filename-based fallback supplies missing build provenance.
   * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain copying, order, caller mutation, validation failure and the distinction between representation and trustworthy producer observations.
   * @evidence contracts/portability.md#os-neutral-implementation Admission preserves validated native path strings exactly; absolute filename grammar is delegated to RuntimeEmitProvenance without case folding or separator conversion.
   * @evidence contracts/performance.md#efficient-algorithms One copy visits output names and provenance associations once in O(O + S) entries; one new snapshot is appended without rescanning older builds.
   * @evidence contracts/performance.md#reuse-equivalent-work An admitted snapshot supplies one stable identity to every ownership lookup; admission invalidates only the combined manifest view, and never reuses a previous build's callback result as a new preparation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The registry retains one owned metadata snapshot per preparation until exit, growing with the recorded builds and associations; caller arrays are not retained and no native handle is acquired.
   */
  export function registerManifest(manifest: RuntimeManifest): void {
    const captured = snapshotManifest(manifest);
    if (
      !isRuntimeManifestShape(captured) ||
      !RuntimeEmitProvenance.isRecord(captured.emittedSources)
    ) {
      throw new Error(
        "ttsx: checked preparation has invalid runtime manifest metadata",
      );
    }
    registeredManifests.push(captured);
    manifestView = undefined;
  }

  function environmentManifest(): RuntimeManifest | null {
    if (environmentManifestCache !== undefined) {
      return environmentManifestCache;
    }
    const file = process.env.TTSX_RUNTIME_MANIFEST;
    if (file === undefined || file.length === 0) {
      environmentManifestCache = null;
      return environmentManifestCache;
    }
    let value: unknown;
    try {
      value = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      environmentManifestCache = null;
      return environmentManifestCache;
    }
    if (!isRuntimeManifestShape(value)) {
      environmentManifestCache = null;
    } else if (!RuntimeEmitProvenance.isRecord(value.emittedSources)) {
      throw new Error(
        "ttsx: inherited runtime manifest has no valid compiler emit provenance; prepare the entry again with this ttsc version",
      );
    } else {
      environmentManifestCache = snapshotManifest(value as RuntimeManifest);
    }
    return environmentManifestCache;
  }

  /**
   * Every checked entry emit available to this runtime, in ownership order. An
   * unreadable or malformed inherited manifest contributes no entry.
   *
   * A recognizable build manifest without valid emit provenance throws an
   * unsupported-manifest error rather than silently changing its serving lane.
   * The returned view and build metadata are owned frozen snapshots, shared
   * until a later registration adds another checked preparation.
   *
   * @evidence contracts/common.md#principled-implementation The inherited checked build precedes roots prepared here; malformed JSON contributes no manifest, while a recognizable build without actual emit provenance fails explicitly because its original preparation inputs are unavailable.
   * @evidence contracts/common.md#clear-and-simple-design The accessor assembles and shares one ordered view of owned manifest snapshots without exposing its mutable registration array or lazy environment decoding.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The accessor supplies only the supported inherited and registered lanes and does not invent an unchecked fallback manifest.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines ordering, unreadable/malformed absence, explicit missing-provenance failure and frozen-view lifetime rather than merely repeating the return type.
   * @evidence contracts/portability.md#os-neutral-implementation The inherited path is read through Node fs; returned manifests retain native build paths and protocol output spelling without separator or case conversion here.
   * @evidence contracts/performance.md#efficient-algorithms Constructing the ordered view costs O(M) only after registration invalidates it; repeated access returns the same view without decoding JSON, rescanning directories or copying the list again.
   * @evidence contracts/performance.md#reuse-equivalent-work Lazy decoding shares the inherited owned snapshot for the process; registration invalidates the ordered view so subsequent calls include each new preparation without changing earlier build metadata.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This accessor returns the registry-owned manifests and owns no separate retained index, descriptor or task; the namespace defines their process lifetime.
   */
  export function runtimeManifests(): readonly RuntimeManifest[] {
    const inherited = environmentManifest();
    manifestView ??= Object.freeze(
      inherited === null
        ? [...registeredManifests]
        : [inherited, ...registeredManifests],
    );
    return manifestView;
  }

  /**
   * Find the manifest whose checked build emitted `real`, and that emit.
   *
   * A manifest's prepared root is matched first, by its recorded source, so a
   * root keeps precedence over other preparations. Every match, including that
   * root, requires the ownership index's actual compiler output-to-source
   * observations and physical source identity. A file no manifest compiled gets
   * `null` and belongs to another lane, however many emitted files share its
   * name (samchon/ttsc#1382).
   *
   * @evidence contracts/common.md#principled-implementation A prepared entry gets first ownership lookup, but every match must come from actual emitted-source observations in its build index; neither recorded entry filenames nor matching output stems prove source membership.
   * @evidence contracts/common.md#clear-and-simple-design Two explicit passes separate entry precedence from general build ownership, with one index helper owning memoized reverse mapping.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No basename fallback or unchecked-file substitution stands in for proof that a selected manifest compiled the requested source.
   * @evidence contracts/common.md#meaningful-documentation Native prose states prepared-entry precedence, required actual emit provenance and the null lane decision, separated from tags following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation realPath selects prepared-entry precedence and EmitOwnershipIndex establishes native source identity from the compiler observation; filename existence and OS-name case folding cannot certify ownership.
   * @evidence contracts/performance.md#efficient-algorithms Two O(M) manifest passes enforce precedence without sorting; each lookup resolves current native source identity and uses the shared build's preindexed source associations.
   * @evidence contracts/performance.md#reuse-equivalent-work Immutable prepared emit permits one preindexed association record per manifest across import specifiers; query aliases remain fresh and a newly prepared build supplies a distinct manifest identity.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The WeakMap stores indexes for retained manifest objects; registered roots keep their captured source associations until exit, with population proportional to prepared builds and their provenance rather than queried spelling history.
   */
  export function findEntryEmit(real: string): {
    /** Proven owning output; a later missing file remains an output read error. */
    emittedFile: string;

    /** Checked build whose recorded associations established this ownership. */
    manifest: RuntimeManifest;
  } | null {
    const manifests = runtimeManifests();
    for (const candidate of manifests) {
      if (
        candidate.entrySource !== undefined &&
        candidate.entryFile !== undefined &&
        realPath(candidate.entrySource) === real
      ) {
        const emitted = ownershipIndex(candidate).find(real);
        if (emitted !== null) {
          return { emittedFile: emitted, manifest: candidate };
        }
      }
    }
    for (const candidate of manifests) {
      const emitted = ownershipIndex(candidate).find(real);
      if (emitted !== null) {
        return { emittedFile: emitted, manifest: candidate };
      }
    }
    return null;
  }

  /**
   * The ownership index of one manifest's build, created on first use. The
   * entry emit is written once before the run starts and never changes under
   * it, so preindexed output-to-source associations can serve every import
   * specifier. Query aliases are still resolved afresh by the index.
   */
  function ownershipIndex(manifest: RuntimeManifest): EmitOwnershipIndex {
    let index = ownershipIndexes.get(manifest);
    if (index === undefined) {
      index = new EmitOwnershipIndex({
        emitDir: manifest.emitDir,
        outputs: manifest.outputs,
        emittedSources: manifest.emittedSources,
        emittedSourceProofFailures: manifest.emittedSourceProofFailures,
        rootDir: manifest.rootDir,
      });
      ownershipIndexes.set(manifest, index);
    }
    return index;
  }

  const ownershipIndexes = new WeakMap<RuntimeManifest, EmitOwnershipIndex>();

  /** Capture only owned arrays/records; callers retain their mutable originals. */
  function snapshotManifest(manifest: RuntimeManifest): RuntimeManifest {
    const {
      outputs,
      moduleOptions,
      emittedSources,
      emittedSourceProofFailures,
      ...metadata
    } = manifest;
    return Object.freeze({
      ...metadata,
      ...(emittedSourceProofFailures !== null &&
      typeof emittedSourceProofFailures === "object" &&
      !Array.isArray(emittedSourceProofFailures)
        ? {
            emittedSourceProofFailures: Object.freeze(
              Object.fromEntries(
                Object.entries(emittedSourceProofFailures).filter(
                  ([, reason]) => typeof reason === "string",
                ),
              ),
            ),
          }
        : {}),
      ...(outputs === undefined
        ? {}
        : {
            outputs: Array.isArray(outputs)
              ? Object.freeze([...outputs])
              : outputs,
          }),
      ...(moduleOptions === undefined
        ? {}
        : {
            moduleOptions:
              moduleOptions !== null &&
              typeof moduleOptions === "object" &&
              !Array.isArray(moduleOptions)
                ? Object.freeze({ ...moduleOptions })
                : moduleOptions,
          }),
      emittedSources:
        emittedSources !== null &&
        typeof emittedSources === "object" &&
        !Array.isArray(emittedSources)
          ? Object.freeze(
              Object.fromEntries(
                Object.entries(emittedSources).map(([output, sources]) => [
                  output,
                  Array.isArray(sources)
                    ? Object.freeze([...sources])
                    : sources,
                ]),
              ),
            )
          : emittedSources,
    });
  }

  function isRuntimeManifestShape(value: unknown): value is Omit<
    RuntimeManifest,
    "emittedSources"
  > & {
    emittedSources?: unknown;
  } {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const manifest = value as Record<string, unknown>;
    for (const key of ["projectRoot", "rootDir", "emitDir", "depCacheDir"]) {
      if (typeof manifest[key] !== "string") return false;
    }
    for (const key of ["entrySource", "entryFile", "orphanCacheDir"]) {
      if (manifest[key] !== undefined && typeof manifest[key] !== "string") {
        return false;
      }
    }
    if (
      manifest.outputs !== undefined &&
      (!Array.isArray(manifest.outputs) ||
        !manifest.outputs.every((output) => typeof output === "string"))
    ) {
      return false;
    }
    if (manifest.moduleOptions !== undefined) {
      if (
        manifest.moduleOptions === null ||
        typeof manifest.moduleOptions !== "object" ||
        Array.isArray(manifest.moduleOptions)
      ) {
        return false;
      }
      const options = manifest.moduleOptions as Record<string, unknown>;
      for (const key of ["module", "target"]) {
        if (options[key] !== undefined && typeof options[key] !== "string") {
          return false;
        }
      }
    }
    return manifest.plugins === undefined || manifest.plugins === false;
  }
}

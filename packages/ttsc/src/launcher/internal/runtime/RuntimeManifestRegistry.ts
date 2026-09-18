import fs from "node:fs";

import { EmitOwnershipIndex } from "../../../compiler/internal/EmitOwnershipIndex";
import type { RuntimeManifest } from "./RuntimeManifest";
import { realPath } from "./realPath";

/**
 * Every checked entry emit this runtime may serve from, and the lookup that
 * decides which of them owns a source file.
 *
 * A direct ttsx child inherits one manifest through `TTSX_RUNTIME_MANIFEST`;
 * `ttsc/register` adds one per root it prepares. The inherited manifest is read
 * lazily, once per process.
 */
export namespace RuntimeManifestRegistry {
  let environmentManifestCache: RuntimeManifest | null | undefined;

  /**
   * Manifests of the roots this process prepared itself, in preparation order.
   * The runtime appends to it; nothing removes from it.
   */
  export const registeredManifests: RuntimeManifest[] = [];

  function environmentManifest(): RuntimeManifest | null {
    if (environmentManifestCache !== undefined) {
      return environmentManifestCache;
    }
    const file = process.env.TTSX_RUNTIME_MANIFEST;
    if (file === undefined || file.length === 0) {
      environmentManifestCache = null;
      return environmentManifestCache;
    }
    try {
      environmentManifestCache = JSON.parse(
        fs.readFileSync(file, "utf8"),
      ) as RuntimeManifest;
    } catch {
      environmentManifestCache = null;
    }
    return environmentManifestCache;
  }

  /** Every checked entry emit available to this runtime, in ownership order. */
  export function runtimeManifests(): readonly RuntimeManifest[] {
    const inherited = environmentManifest();
    return inherited === null
      ? registeredManifests
      : [inherited, ...registeredManifests];
  }

  /**
   * Find the manifest whose checked build emitted `real`, and that emit.
   *
   * A manifest's prepared root is matched first, by its recorded source, so a
   * root keeps the exact emit its own preparation located. Every other file is
   * owned only by a build that provably compiled it: the ownership index maps
   * outputs back through the build's pinned `rootDir` and compares filesystem
   * identities. A file no manifest compiled gets `null` and belongs to another
   * lane, however many emitted files share its name (samchon/ttsc#1382).
   */
  export function findEntryEmit(
    real: string,
  ): { emittedFile: string; manifest: RuntimeManifest } | null {
    const manifests = runtimeManifests();
    for (const candidate of manifests) {
      if (
        candidate.entrySource !== undefined &&
        candidate.entryFile !== undefined &&
        realPath(candidate.entrySource) === real &&
        fs.existsSync(candidate.entryFile)
      ) {
        return { emittedFile: candidate.entryFile, manifest: candidate };
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
   * The ownership index of one manifest's build, created on first use. The entry
   * emit is written once before the run starts and never changes under it, and
   * the index memoizes every answer, which matters because the `resolve` hook
   * asks through `owningModuleOptions` once per import specifier.
   */
  function ownershipIndex(manifest: RuntimeManifest): EmitOwnershipIndex {
    let index = ownershipIndexes.get(manifest);
    if (index === undefined) {
      index = new EmitOwnershipIndex({
        emitDir: manifest.emitDir,
        outputs: manifest.outputs,
        rootDir: manifest.rootDir,
      });
      ownershipIndexes.set(manifest, index);
    }
    return index;
  }

  const ownershipIndexes = new WeakMap<RuntimeManifest, EmitOwnershipIndex>();
}

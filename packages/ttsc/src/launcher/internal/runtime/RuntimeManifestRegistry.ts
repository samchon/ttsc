import fs from "node:fs";
import { resolveEmittedJavaScript } from "../../../compiler/internal/resolveEmittedJavaScript";
import type { RuntimeManifest } from "./RuntimeManifest";
import { realPath } from "./realPath";
import { isWithin } from "./isWithin";

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
 * Find the manifest that owns `real`. Explicit prepared roots win, followed by
 * exact mirrored paths across every manifest. Only then may legacy stem
 * recovery run, so one manifest's approximate match cannot shadow another's
 * exact emit.
 */
export function findEntryEmit(
  real: string,
  allowStemFallback: boolean = true,
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
    const emitted = entryEmitPath(candidate, real, false);
    if (emitted !== null) {
      return { emittedFile: emitted, manifest: candidate };
    }
  }
  if (!allowStemFallback) {
    return null;
  }
  for (const candidate of manifests) {
    const emitted = entryEmitPath(candidate, real, true);
    if (emitted !== null) {
      return { emittedFile: emitted, manifest: candidate };
    }
  }
  return null;
}

/**
 * The entry project's emitted JavaScript for `real`, or `null` when that
 * project did not emit it. Shared with `owningModuleOptions` so "the entry
 * project owns this file" means exactly one thing in both places.
 */
function entryEmitPath(
  m: RuntimeManifest,
  real: string,
  allowStemFallback: boolean = true,
): string | null {
  const cache = allowStemFallback
    ? entryEmitPathCache
    : exactEntryEmitPathCache;
  let manifestCache = cache.get(m);
  if (manifestCache === undefined) {
    manifestCache = new Map<string, string | null>();
    cache.set(m, manifestCache);
  }
  if (manifestCache.has(real)) {
    return manifestCache.get(real) ?? null;
  }
  const resolved = isWithin(real, m.rootDir)
    ? resolveEmittedJavaScript({
        allowStemFallback,
        emittedFiles: m.emittedFiles,
        outDir: m.emitDir,
        projectRoot: m.rootDir,
        sourceFile: real,
      })
    : null;
  manifestCache.set(real, resolved);
  return resolved;
}

/**
 * Memo for `entryEmitPath`, because it is now on the `resolve` hook's path
 * through `owningModuleOptions` — once per import specifier — and a miss inside
 * `resolveEmittedJavaScript` walks the whole emit tree. The entry emit is
 * written once before the run starts and never changes under it. Registration
 * can add several independent entry emits, so the manifest is part of the cache
 * identity as well as the source path.
 */
const entryEmitPathCache = new WeakMap<
  RuntimeManifest,
  Map<string, string | null>
>();

const exactEntryEmitPathCache = new WeakMap<
  RuntimeManifest,
  Map<string, string | null>
>();
}

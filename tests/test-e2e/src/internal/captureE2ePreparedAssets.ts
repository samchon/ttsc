import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Captures explicitly selected prepared assets without executing a tool.
 * The coordinator supplies actual resolved executable/module/fixture paths;
 * this helper does not guess PATH, shell normalization or loaded-image identity.
 * Native metadata brackets each full-byte hash. This is an observed stable
 * file interval, not an atomic freeze or proof that a process loaded these bytes.
 *
 * @evidence contracts/common.md#principled-implementation Hashes actual selected physical file bytes and preserves requested/real paths with before/after native identity metadata. Changed observations fail preparation rather than being labelled a frozen producer.
 * @evidence contracts/common.md#clear-and-simple-design One explicit input list binds executable, instrumentation, module, fixture and configuration assets; process/runtime facts remain separate trace observations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not resolve a guessed executable, launch a version probe, infer loaded image from a version string or replace actual trace population with expected artifacts.
 * @evidence contracts/common.md#meaningful-documentation States explicit selection, native observation interval and the remaining coordinator/process identity responsibilities.
 * @evidence contracts/portability.md#os-neutral-implementation Uses native realpath/stat and SHA256 over actual bytes, retaining path spelling and bigint metadata strings without case folding or OS-derived equality.
 * @evidence contracts/performance.md#efficient-algorithms Reads each explicit file once for hashing, with native metadata checks around the read. Work and peak complete-buffer memory scale with actual selected file sizes; no source-tree sweep is performed.
 * @evidence contracts/performance.md#reuse-equivalent-work One snapshot supplies path, byte hash and identity facts; a later phase requires its own current observation, not a cached file verdict.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous file operations close before return; byte buffers stay local and only finite metadata transfers to the caller. It creates no scratch root, process or retained descriptor.
 */
export function captureE2ePreparedAssets(
  assets: readonly PreparedAssetSelection[],
): PreparedAssetObservation[] {
  const labels = new Set<string>();
  return assets.map(asset => {
    if (labels.has(asset.label)) throw new Error("Duplicate prepared asset label: " + asset.label);
    labels.add(asset.label);
    const requestedPath = path.resolve(asset.file);
    const realPath = fs.realpathSync.native(requestedPath);
    const before = fs.statSync(realPath, { bigint: true });
    if (!before.isFile()) throw new Error("Prepared asset is not a regular file: " + requestedPath);
    const bytes = fs.readFileSync(realPath);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const after = fs.statSync(realPath, { bigint: true });
    const identityBefore = {
      dev: before.dev.toString(), ino: before.ino.toString(), size: before.size.toString(), mode: before.mode.toString(),
      mtimeNs: before.mtimeNs.toString(), ctimeNs: before.ctimeNs.toString(),
    };
    const identityAfter = {
      dev: after.dev.toString(), ino: after.ino.toString(), size: after.size.toString(), mode: after.mode.toString(),
      mtimeNs: after.mtimeNs.toString(), ctimeNs: after.ctimeNs.toString(),
    };
    if (!after.isFile() || JSON.stringify(identityBefore) !== JSON.stringify(identityAfter) ||
      BigInt(bytes.length) !== after.size || fs.realpathSync.native(requestedPath) !== realPath)
      throw new Error("Prepared asset changed during observation: " + requestedPath);
    return { label: asset.label, role: asset.role, requestedPath, realPath,
      observedBytes: bytes.length, sha256, identityBefore, identityAfter };
  });
}

/** Coordinator-selected paths, never an implicit workspace or fixture census. */
export interface PreparedAssetSelection {
  label: string;
  file: string;
  role: "executable" | "instrumentation-source" | "loaded-module" | "fixture" | "configuration";
}

/** File observation only; actual loaded/process/runtime identities stay separate. */
export interface PreparedAssetObservation {
  label: string;
  role: PreparedAssetSelection["role"];
  requestedPath: string;
  realPath: string;
  observedBytes: number;
  sha256: string;
  identityBefore: Record<string, string>;
  identityAfter: Record<string, string>;
}

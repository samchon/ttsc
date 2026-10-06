import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2ETrace } from "./E2ETrace";

/**
 * Fingerprint an absolute executable's spelling, target and actual bytes.
 *
 * A changed link, file, or read failure yields no reusable identity. Metadata
 * brackets the streamed read; it is not used to reuse an earlier content hash.
 * Concurrent writes that evade every filesystem observation remain outside this
 * snapshot guarantee.
 *
 * @evidence contracts/common.md#principled-implementation The identity joins lexical-link metadata, the selected physical file metadata and SHA-256 of that opened file; matching metadata alone cannot authorize reuse after bytes change. Descriptor and pathname observations must still agree after reading.
 * @evidence contracts/common.md#clear-and-simple-design This one native owner supplies the same content proof to runtime capability and plugin caches; callers decide whether their other inputs permit reuse.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported Node filesystem and crypto APIs inspect the actual candidate; no fixture identity, foreign mutation or metadata-only shortcut substitutes for content.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains absolute-path scope, failure meaning, hash freshness and the remaining concurrent-mutation limitation, with separate prose and tags.
 * @evidence contracts/portability.md#os-neutral-implementation Node native realpath and bigint stat preserve link/target identity on supported hosts; absolute paths use native platform semantics, and unreadable or non-regular targets cannot be reused.
 * @evidence contracts/performance.md#efficient-algorithms A sequential read hashes B bytes with one 64 KiB buffer instead of a complete executable allocation. Native path/realpath/stat observations and serialized physical spelling/metadata add text/lookup costs; B and spelling lengths have no quota here. Returned identity storage includes the physical path as well as the fixed-length digest.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation establishes whether later work is equivalent; retaining a digest by metadata would reproduce the stale-byte defect it must prevent.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources One descriptor and one fixed buffer belong to this synchronous call; finally attempts closure after read/observation failures as well as success. A close failure returns no identity but cannot confirm native release. Returned path/metadata/digest text transfers to the caller and no helper history survives.
 */
export function runtimeExecutableIdentity(runtime: string): string | undefined {
  if (!path.isAbsolute(runtime)) return undefined;
  const startedAt = new Date().toISOString();
  let descriptor: number | undefined;
  let stage = "lexical-stat";
  const unavailable = (reason: string, expected?: string, observed?: string,
    observations?: { before: fs.BigIntStats; after: fs.BigIntStats }) => {
    E2ETrace.capabilityResolution("runtime-executable-identity-unavailable", {
      runtime, stage, reason, expected, observed,
      expectedAtimeNs: observations === undefined ? undefined : String(observations.before.atimeNs),
      observedAtimeNs: observations === undefined ? undefined : String(observations.after.atimeNs),
      expectedBirthtimeNs: observations === undefined ? undefined : String(observations.before.birthtimeNs),
      observedBirthtimeNs: observations === undefined ? undefined : String(observations.after.birthtimeNs),
    });
    return undefined;
  };
  try {
    const lexical = fs.lstatSync(runtime, { bigint: true });
    stage = "physical-realpath";
    const physicalPath = fs.realpathSync.native(runtime);
    stage = "physical-stat";
    const physical = fs.statSync(physicalPath, { bigint: true });
    if (!physical.isFile()) return unavailable("not-regular", undefined, fileIdentity(physical));
    stage = "open";
    descriptor = fs.openSync(physicalPath, "r");
    stage = "opened-stat";
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (fileIdentity(opened) !== fileIdentity(physical))
      return unavailable("opened-file-changed", fileIdentity(physical), fileIdentity(opened));
    const hash = crypto.createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let remaining = opened.size;
    stage = "read";
    while (remaining > 0n) {
      const requested =
        remaining > BigInt(buffer.length) ? buffer.length : Number(remaining);
      const length = fs.readSync(descriptor, buffer, 0, requested, null);
      if (length === 0) return unavailable("premature-eof", String(opened.size), String(opened.size - remaining));
      hash.update(buffer.subarray(0, length));
      remaining -= BigInt(length);
    }
    stage = "post-read-opened-stat";
    const afterOpened = fs.fstatSync(descriptor, { bigint: true });
    if (fileIdentity(afterOpened) !== fileIdentity(opened))
      return unavailable("opened-file-changed-during-read", fileIdentity(opened), fileIdentity(afterOpened), { before: opened, after: afterOpened });
    stage = "post-read-realpath";
    const afterPath = fs.realpathSync.native(runtime);
    if (afterPath !== physicalPath)
      return unavailable("physical-target-changed", physicalPath, afterPath);
    stage = "post-read-lexical-stat";
    const afterLexical = fs.lstatSync(runtime, { bigint: true });
    if (fileIdentity(afterLexical) !== fileIdentity(lexical))
      return unavailable("lexical-file-changed-during-read", fileIdentity(lexical), fileIdentity(afterLexical));
    stage = "post-read-physical-stat";
    const afterPhysical = fs.statSync(physicalPath, { bigint: true });
    if (fileIdentity(afterPhysical) !== fileIdentity(physical))
      return unavailable("physical-file-changed-during-read", fileIdentity(physical), fileIdentity(afterPhysical));
    const digest = hash.digest("hex");
    E2ETrace.capabilityResolution("runtime-executable-identity-observed", {
      runtime, physicalPath, startedAt, finishedAt: new Date().toISOString(),
      lexical: fileIdentity(lexical), physical: fileIdentity(physical), digest,
      openedAtimeNs: String(opened.atimeNs), afterOpenedAtimeNs: String(afterOpened.atimeNs),
      openedBirthtimeNs: String(opened.birthtimeNs), afterOpenedBirthtimeNs: String(afterOpened.birthtimeNs),
    });
    return [
      physicalPath,
      fileIdentity(lexical),
      fileIdentity(physical),
      digest,
    ].join("\0");
  } catch (error) {
    return unavailable("filesystem-error", undefined, error instanceof Error ? error.message : String(error));
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (error) {
        stage = "close";
        return unavailable("descriptor-close-error", undefined, error instanceof Error ? error.message : String(error));
      }
    }
  }
}

/** Bigint metadata distinguishes file replacement and observed writes. */
function fileIdentity(stat: fs.BigIntStats): string {
  return [
    stat.dev,
    stat.ino,
    stat.mode,
    stat.size,
    stat.mtimeNs,
    stat.ctimeNs,
  ].join("\0");
}

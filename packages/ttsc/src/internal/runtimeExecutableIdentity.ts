import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { threadId } from "node:worker_threads";

import { PluginContentIdentities } from "../plugin/internal/source/PluginContentIdentities";
import { E2ETrace } from "./E2ETrace";

/**
 * Fingerprint an absolute executable's spelling, target and actual bytes.
 *
 * A changed link, file, or read failure yields no reusable identity. Metadata
 * brackets the streamed read. Concurrent writes that evade every filesystem
 * observation remain outside this snapshot guarantee.
 *
 * With a record store, the bytes of an unchanged executable are proven from its
 * metadata instead of streamed again (`PluginContentIdentities`, #1723): the
 * recorded digest stands only while the physical file's identity, size and both
 * stamps match the record and its modification stamp is separable from a
 * reference the store minted. A plugin load asks for this identity several
 * times, and every launch is a new process, so streaming an 85 MB runtime each
 * time cost about 0.9 s per launch. Without a store, or when that proof is
 * unavailable, the file is streamed as before.
 *
 * @param runtime The executable, absolute.
 * @param identities Optional record store of the caller's plugin cache.
 * @evidence contracts/common.md#principled-implementation The identity joins lexical-link metadata, the selected physical file metadata and the SHA-256 of that file's bytes, streamed under metadata brackets or proven by a record whose separable signature still matches; descriptor and pathname observations must still agree after a read.
 * @evidence contracts/common.md#clear-and-simple-design This one native owner supplies the same identity to runtime capability and plugin caches; the record store owns metadata reuse and a private helper owns the bracketed stream.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Metadata alone never stands for bytes: reuse needs a record written under unchanged separable metadata around an actual read, which a same-tick rewrite or restored timestamps cannot satisfy because change time and the minted reference move.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains absolute-path scope, failure meaning, the record proof and the remaining concurrent-mutation limitation, with separate prose and tags.
 * @evidence contracts/portability.md#os-neutral-implementation Node native realpath and bigint stat preserve link/target identity on supported hosts; absolute paths use native platform semantics, and unreadable or non-regular targets cannot be reused.
 * @evidence contracts/performance.md#efficient-algorithms A proven record costs three stats and one small file read; otherwise a sequential read hashes B bytes with one 64 KiB buffer instead of a complete executable allocation. Native path/realpath/stat observations and serialized metadata add text/lookup costs.
 * @evidence contracts/performance.md#reuse-equivalent-work Processes share an executable digest only through the record store's separable-signature proof; without a store every call streams the file.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One descriptor and one fixed buffer belong to a streamed read; finally attempts closure after read/observation failures as well as success. A close failure returns no identity but cannot confirm native release. Opt-in opened/closed/close-failed observations carry one trace-only call id and actual descriptor, PID/thread and already observed physical identity. Records belong to the single-file collector.
 */
export function runtimeExecutableIdentity(
  runtime: string,
  identities?: PluginContentIdentities.Store,
): string | undefined {
  if (!path.isAbsolute(runtime)) return undefined;
  const startedAt = new Date().toISOString();
  let stage = "lexical-stat";
  let refused: IUnavailable | undefined;
  try {
    const lexical = fs.lstatSync(runtime, { bigint: true });
    stage = "physical-realpath";
    const physicalPath = fs.realpathSync.native(runtime);
    stage = "physical-stat";
    const physical = fs.statSync(physicalPath, { bigint: true });
    if (!physical.isFile())
      return unavailable(runtime, {
        stage,
        reason: "not-regular",
        observed: fileIdentity(physical),
      });
    const read = (): string => {
      const streamed = streamDigest(runtime, physicalPath, physical, lexical, {
        startedAt,
      });
      if (typeof streamed === "string") return streamed;
      refused = streamed;
      throw new Error(streamed.reason);
    };
    const digest =
      identities === undefined
        ? read()
        : PluginContentIdentities.digest(
            identities,
            "executable",
            physicalPath,
            (references) =>
              PluginContentIdentities.fileObservation(references, physicalPath),
            read,
          );
    return [
      physicalPath,
      fileIdentity(lexical),
      fileIdentity(physical),
      digest,
    ].join("\0");
  } catch (error) {
    return unavailable(
      runtime,
      refused ?? {
        stage,
        reason: "filesystem-error",
        observed: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

/** Why an identity could not be formed, at the stage that found it. */
interface IUnavailable {
  stage: string;
  reason: string;
  expected?: string;
  observed?: string;
  observations?: { before: fs.BigIntStats; after: fs.BigIntStats };
}

function unavailable(runtime: string, failure: IUnavailable): undefined {
  E2ETrace.capabilityResolution("runtime-executable-identity-unavailable", {
    runtime,
    stage: failure.stage,
    reason: failure.reason,
    expected: failure.expected,
    observed: failure.observed,
    expectedAtimeNs:
      failure.observations === undefined
        ? undefined
        : String(failure.observations.before.atimeNs),
    observedAtimeNs:
      failure.observations === undefined
        ? undefined
        : String(failure.observations.after.atimeNs),
    expectedBirthtimeNs:
      failure.observations === undefined
        ? undefined
        : String(failure.observations.before.birthtimeNs),
    observedBirthtimeNs:
      failure.observations === undefined
        ? undefined
        : String(failure.observations.after.birthtimeNs),
  });
  return undefined;
}

/**
 * Stream the physical file's bytes between metadata observations of the open
 * descriptor, the physical path and the lexical spelling, returning the digest
 * or what moved. The descriptor is closed in finally; a failed close refuses
 * the identity.
 */
function streamDigest(
  runtime: string,
  physicalPath: string,
  physical: fs.BigIntStats,
  lexical: fs.BigIntStats,
  timing: { startedAt: string },
): string | IUnavailable {
  let stage = "open";
  let descriptor: number | undefined;
  let traceLease: Readonly<Record<string, string | number>> | undefined;
  let result: string | IUnavailable;
  try {
    result = observe();
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
        if (traceLease !== undefined)
          E2ETrace.capabilityResolution(
            "runtime-executable-identity-closed",
            traceLease,
          );
      } catch (error) {
        if (traceLease !== undefined)
          E2ETrace.capabilityResolution(
            "runtime-executable-identity-close-failed",
            {
              ...traceLease,
              error: error instanceof Error ? error.message : String(error),
            },
          );
        // A digest whose descriptor could not be closed is refused, as before.
        result = {
          stage: "close",
          reason: "descriptor-close-error",
          observed: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }
  return result;

  function observe(): string | IUnavailable {
    try {
      descriptor = fs.openSync(physicalPath, "r");
      if (process.env.TTSC_E2E_TRACE) {
        traceLease = {
          callId: String(++identityTraceOrdinal),
          runtime,
          physicalPath,
          descriptor,
          pid: process.pid,
          threadId,
          dev: String(physical.dev),
          ino: String(physical.ino),
        };
        E2ETrace.capabilityResolution(
          "runtime-executable-identity-opened",
          traceLease,
        );
      }
      stage = "opened-stat";
      const opened = fs.fstatSync(descriptor, { bigint: true });
      if (fileIdentity(opened) !== fileIdentity(physical))
        return {
          stage,
          reason: "opened-file-changed",
          expected: fileIdentity(physical),
          observed: fileIdentity(opened),
        };
      const hash = crypto.createHash("sha256");
      const buffer = Buffer.allocUnsafe(64 * 1024);
      let remaining = opened.size;
      stage = "read";
      while (remaining > 0n) {
        const requested =
          remaining > BigInt(buffer.length) ? buffer.length : Number(remaining);
        const length = fs.readSync(descriptor, buffer, 0, requested, null);
        if (length === 0)
          return {
            stage,
            reason: "premature-eof",
            expected: String(opened.size),
            observed: String(opened.size - remaining),
          };
        hash.update(buffer.subarray(0, length));
        remaining -= BigInt(length);
      }
      stage = "post-read-opened-stat";
      const afterOpened = fs.fstatSync(descriptor, { bigint: true });
      if (fileIdentity(afterOpened) !== fileIdentity(opened))
        return {
          stage,
          reason: "opened-file-changed-during-read",
          expected: fileIdentity(opened),
          observed: fileIdentity(afterOpened),
          observations: { before: opened, after: afterOpened },
        };
      stage = "post-read-realpath";
      const afterPath = fs.realpathSync.native(runtime);
      if (afterPath !== physicalPath)
        return {
          stage,
          reason: "physical-target-changed",
          expected: physicalPath,
          observed: afterPath,
        };
      stage = "post-read-lexical-stat";
      const afterLexical = fs.lstatSync(runtime, { bigint: true });
      if (fileIdentity(afterLexical) !== fileIdentity(lexical))
        return {
          stage,
          reason: "lexical-file-changed-during-read",
          expected: fileIdentity(lexical),
          observed: fileIdentity(afterLexical),
        };
      stage = "post-read-physical-stat";
      const afterPhysical = fs.statSync(physicalPath, { bigint: true });
      if (fileIdentity(afterPhysical) !== fileIdentity(physical))
        return {
          stage,
          reason: "physical-file-changed-during-read",
          expected: fileIdentity(physical),
          observed: fileIdentity(afterPhysical),
        };
      const digest = hash.digest("hex");
      E2ETrace.capabilityResolution("runtime-executable-identity-observed", {
        runtime,
        physicalPath,
        startedAt: timing.startedAt,
        finishedAt: new Date().toISOString(),
        lexical: fileIdentity(lexical),
        physical: fileIdentity(physical),
        digest,
        openedAtimeNs: String(opened.atimeNs),
        afterOpenedAtimeNs: String(afterOpened.atimeNs),
        openedBirthtimeNs: String(opened.birthtimeNs),
        afterOpenedBirthtimeNs: String(afterOpened.birthtimeNs),
      });
      return digest;
    } catch (error) {
      return {
        stage,
        reason: "filesystem-error",
        observed: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Trace-only ordinal distinguishes sequential uses of a reused descriptor.
let identityTraceOrdinal = 0;

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

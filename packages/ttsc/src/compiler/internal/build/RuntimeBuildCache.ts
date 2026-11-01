import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2ETrace } from "../../../internal/E2ETrace";
import { recordCacheFileUse } from "../../../plugin/internal/source/recordCacheFileUse";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";

/**
 * Persist completed private runtime emits as checksummed, atomically published
 * documents. Readers copy admitted bytes into their own run directory, so cache
 * collection and concurrent publications cannot remove an executing run's emit.
 * Input discovery and producer-proof admission belong to the supplied owners.
 *
 * @evidence contracts/common.md#principled-implementation Content-addressed input snapshots select a complete checksummed result and output document; copies retain per-run ownership and atomic rename publishes only completed documents.
 * @evidence contracts/common.md#clear-and-simple-design One operation coordinates lookup, proof, restore and publication; input capture and producer validation remain separate callbacks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Misses execute the original build exactly once; missing or failed input proofs never manufacture successful output.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes persistent storage, run-owned copies and the input/proof owners, and run documents callback stability and failure behavior.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths and rename own storage; output names are checked relative coordinates and symlinks are refused rather than followed into another tree.
 * @evidence contracts/performance.md#efficient-algorithms A lookup hashes snapshot text and reads/hashes the bounded document; restoring and publication scale with output bytes and file count, without traversing unrelated source trees.
 * @evidence contracts/performance.md#reuse-equivalent-work Equal snapshots reuse completed emits only after independent producer admission and a second current snapshot; concurrent publishers may duplicate compilation but cannot expose partial documents.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Documents are capped at 128 MiB and stored in the existing collected single-file cache population; snapshots and decoded bytes are invocation-owned, staging files are removed on failure and run owners release restored output.
 */
export namespace RuntimeBuildCache {
  const FORMAT = "ttsx-runtime-build-v1";
  const MAX_BYTES = 128 * 1024 * 1024;

  /**
   * Reuse a proven private emit, or invoke the original producer once. Capture
   * returns a deterministic complete input snapshot, or undefined to decline
   * caching. Admission must validate the producer's extra input observations;
   * the second argument is the output root that producer actually used. Cache
   * IO or cache-admission failure costs reuse only. Errors thrown by the
   * original build retain their normal failure policy.
   *
   * @evidence contracts/common.md#principled-implementation Lookup and publication bracket current input snapshots, preserve the actual producer result and require explicit extra-input admission; cache-hit output is copied before the result is rebased.
   * @evidence contracts/common.md#clear-and-simple-design Snapshot, proof and build callbacks expose their independent responsibilities while the operation alone owns storage and restore cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only successful complete emits are published; malformed, oversized, damaged or unproved documents fall through to the caller's real producer without changing compiler selection.
   * @evidence contracts/common.md#meaningful-documentation Native prose states complete-snapshot meaning, producer-root coordinates, callback error policy and recoverable cache IO.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat refuses aliases, path.relative checks containment and native mkdir/write/rename preserve byte payloads and host path semantics.
   * @evidence contracts/performance.md#efficient-algorithms Snapshot owners dominate input work; document read/parse/hash and base64 restore scale with bounded encoded bytes, while publication walks only private output and serializes it once.
   * @evidence contracts/performance.md#reuse-equivalent-work A format-and-snapshot digest names one candidate; checksum, output grammar, producer admission and unchanged recapture are independent reuse gates. Every miss calls build once.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Call-local decoded outputs and serialized documents are bounded by the 128 MiB admission ceiling, except fresh output collection precedes serialization; partial restores are unlinked and staging removal is attempted in finally. Collector failures can retain files under the existing cache policy.
   */
  export function run(props: {
    /** Collected single-file cache root, or undefined to bypass persistence. */
    directory?: string;
    /** Empty private output directory owned by this build's caller. */
    emitDir: string;
    /** Fresh complete input snapshot; undefined preserves ordinary execution. */
    capture: () => string | undefined;
    /** Producer-specific proof, with its original private output root. */
    admit: (result: TtscBuildResult, emitDir: string) => boolean;
    /** Original build operation, including its diagnostic policy. */
    build: () => TtscBuildResult;
  }): TtscBuildResult {
    if (props.directory === undefined) return props.build();
    let snapshot: string | undefined;
    try {
      snapshot = props.capture();
    } catch {
      /* An unavailable proof is a miss. */
    }
    if (snapshot === undefined) return props.build();
    const key = digest(FORMAT + "\0" + snapshot);
    const file = path.join(props.directory, key + ".json");
    const restored: string[] = [];
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES)
        throw new Error("unusable runtime cache document");
      const document = JSON.parse(fs.readFileSync(file, "utf8"));
      if (
        document.format !== FORMAT ||
        typeof document.payload !== "string" ||
        document.hash !== digest(document.payload)
      )
        throw new Error("invalid runtime cache checksum");
      const entry = JSON.parse(document.payload);
      if (
        entry.snapshot !== snapshot ||
        typeof entry.emitDir !== "string" ||
        !path.isAbsolute(entry.emitDir) ||
        entry.result?.status !== 0 ||
        !Array.isArray(entry.outputs) ||
        !props.admit(entry.result, entry.emitDir)
      )
        throw new Error("unproved runtime cache document");
      const names = new Set<string>();
      for (const output of entry.outputs) {
        if (
          !Array.isArray(output) ||
          output.length !== 2 ||
          typeof output[0] !== "string" ||
          typeof output[1] !== "string" ||
          !safeRelative(output[0]) ||
          names.has(output[0]) ||
          Buffer.from(output[1], "base64").toString("base64") !== output[1]
        )
          throw new Error("invalid runtime cache output");
        names.add(output[0]);
      }
      for (const output of Object.keys(entry.result.emittedSources ?? {}))
        if (!names.has(path.relative(entry.emitDir, output)))
          throw new Error("missing runtime cache provenance output");
      for (const [name, bytes] of entry.outputs) {
        const target = path.join(props.emitDir, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, Buffer.from(bytes, "base64"), { flag: "wx" });
        restored.push(target);
      }
      if (
        props.capture() !== snapshot ||
        !props.admit(entry.result, entry.emitDir)
      )
        throw new Error("runtime inputs moved during restore");
      recordCacheFileUse(file);
      E2ETrace.capabilityResolution("runtime-build-cache", {
        outcome: "reused",
        key,
      });
      return relocate(entry.result, entry.emitDir, props.emitDir);
    } catch {
      for (const output of restored) fs.unlinkSync(output);
    }
    const result = props.build();
    if (result.status !== 0) return result;
    let temporary: string | undefined;
    try {
      const outputs: [string, string][] = [];
      let outputBytes = 0;
      const pending = [props.emitDir];
      while (pending.length !== 0) {
        const directory = pending.pop()!;
        for (const child of fs.readdirSync(directory, {
          withFileTypes: true,
        })) {
          const target = path.join(directory, child.name);
          if (child.isSymbolicLink()) throw new Error("aliased runtime output");
          if (child.isDirectory()) pending.push(target);
          else if (child.isFile()) {
            outputBytes += fs.statSync(target).size;
            if (outputBytes > MAX_BYTES * 0.7) return result;
            outputs.push([
              path.relative(props.emitDir, target),
              fs.readFileSync(target).toString("base64"),
            ]);
          } else throw new Error("nonordinary runtime output");
        }
      }
      if (outputs.length === 0) return result;
      const payload = JSON.stringify({
        snapshot,
        emitDir: props.emitDir,
        result,
        outputs,
      });
      const text = JSON.stringify({
        format: FORMAT,
        hash: digest(payload),
        payload,
      });
      if (Buffer.byteLength(text) > MAX_BYTES) return result;
      if (props.capture() !== snapshot || !props.admit(result, props.emitDir))
        return result;
      fs.mkdirSync(props.directory, { recursive: true });
      if (fs.lstatSync(props.directory).isSymbolicLink()) return result;
      temporary = path.join(
        props.directory,
        `${key}.${crypto.randomUUID()}.tmp`,
      );
      fs.writeFileSync(temporary, text, { flag: "wx" });
      fs.renameSync(temporary, file);
      E2ETrace.capabilityResolution("runtime-build-cache", {
        outcome: "recorded",
        key,
      });
    } catch {
      /* Persistence never replaces a fresh successful result. */
    } finally {
      if (temporary !== undefined) {
        try {
          fs.unlinkSync(temporary);
        } catch {
          /* Rename or later collection owns it. */
        }
      }
    }
    return result;
  }

  /**
   * Hash encoded input or document bytes with SHA-256.
   *
   * @evidence contracts/common.md#principled-implementation SHA-256 identifies exact UTF-8 text bytes, with caller-owned semantic completeness.
   * @evidence contracts/common.md#clear-and-simple-design One codec supplies keys and payload checksums.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The digest consumes supplied bytes without expected-value substitutions.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the byte codec and algorithm.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Text hashing has no native boundary.
   * @evidence contracts/performance.md#efficient-algorithms Hashing scans the encoded text bytes once.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure codec owns no result cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the returned digest escapes.
   */
  function digest(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  /**
   * Admit only a nonempty relative descendant coordinate.
   *
   * @evidence contracts/common.md#principled-implementation Native normalization and component comparison reject absolute, dot and parent traversal coordinates.
   * @evidence contracts/common.md#clear-and-simple-design One predicate gates every transported output name.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No filename suffix or consumer name grants containment.
   * @evidence contracts/common.md#meaningful-documentation The headline states the accepted coordinate domain.
   * @evidence contracts/portability.md#os-neutral-implementation Native path parsing preserves host separators and rejects Windows drive-relative roots.
   * @evidence contracts/performance.md#efficient-algorithms Normalization and component tests scale with path bytes.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each transported name is independently checked.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No retained resource is acquired.
   */
  function safeRelative(name: string): boolean {
    return (
      name.length !== 0 &&
      !name.includes("\0") &&
      !path.isAbsolute(name) &&
      path.parse(name).root === "" &&
      path.normalize(name) === name &&
      name !== "." &&
      name !== ".." &&
      !name.startsWith(".." + path.sep)
    );
  }

  /**
   * Move producer-owned output coordinates to the current private run.
   *
   * @evidence contracts/common.md#principled-implementation Each rebased provenance/file coordinate must be a relative descendant of the original producer root; source paths remain unchanged.
   * @evidence contracts/common.md#clear-and-simple-design One result adapter owns output relocation without changing source identity or loader behavior.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual producer ownership is retained rather than inferred from output stems.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies output-only relocation.
   * @evidence contracts/portability.md#os-neutral-implementation Native relative/join operations preserve filesystem coordinate semantics.
   * @evidence contracts/performance.md#efficient-algorithms Result projection scans reported output paths and stream bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work The completed producer's source ledger is shared with the new run's private byte copy.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Returned metadata belongs to the run; the adapter owns no file handle or history.
   */
  function relocate(
    result: TtscBuildResult,
    previous: string,
    current: string,
  ): TtscBuildResult {
    const move = (output: string): string => {
      const relative = path.relative(previous, output);
      if (!safeRelative(relative))
        throw new Error("runtime provenance escapes its output root");
      return path.join(current, relative);
    };
    return {
      ...result,
      emittedFiles: result.emittedFiles?.map(move),
      emittedSources:
        result.emittedSources === undefined
          ? undefined
          : Object.fromEntries(
              Object.entries(result.emittedSources).map(([output, sources]) => [
                move(output),
                sources,
              ]),
            ),
      emittedSourceProofFailures:
        result.emittedSourceProofFailures === undefined
          ? undefined
          : Object.fromEntries(
              Object.entries(result.emittedSourceProofFailures).map(
                ([output, reason]) => [move(output), reason],
              ),
            ),
      stdout: result.stdout.split(previous).join(current),
      stderr: result.stderr.split(previous).join(current),
    };
  }
}

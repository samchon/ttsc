import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { recordCacheFileUse } from "../../../plugin/internal/source/recordCacheFileUse";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { RuntimeBuildExplanation } from "./RuntimeBuildExplanation";
import { RuntimeEmitBundle } from "./RuntimeEmitBundle";

/**
 * Persist completed private runtime emits as checksummed, atomically published
 * documents. Readers copy admitted bytes into their own run directory as files
 * or one lazy runtime bundle, so collection cannot remove an executing emit.
 * Input discovery and producer-proof admission belong to the supplied owners.
 *
 * @evidence contracts/common.md#principled-implementation Content-addressed snapshots select complete checksummed result and output documents in the run bundle's own raw layout (RuntimeEmitBundle.archive). SHA-256 consumes exact UTF-8 text and exact output bytes; native normalization rejects absolute, dot, parent and Windows drive-relative output coordinates. Relocation changes producer output coordinates and private-root stream text while retaining source paths.
 * @evidence contracts/common.md#clear-and-simple-design One operation coordinates lookup, proof, restore and publication; RuntimeEmitBundle owns lazy byte representation, while input capture and producer validation remain separate callbacks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Misses execute the original build exactly once; failed or absent proofs never manufacture successful output. Every transported output must be a normalized private descendant, without filename or consumer-name exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes persistent storage, run-owned copies and proof ownership; run states callback stability and failure behavior, and private helper comments identify byte, path and relocation domains.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths, lstat, relative/join and rename own storage and containment, including Windows drive-relative rejection. Source coordinates remain unchanged; transported symlinks are refused rather than followed.
 * @evidence contracts/performance.md#efficient-algorithms Lookup hashes snapshot text and reads only the document's index and annex. Runtime restoration copies the document as the run's bundle, verifies its bodies once and reserves each distinct output directory; ordinary SDK restoration writes each verified output. Publication scales with output bytes and entries; relocation scans producer paths and streams.
 * @evidence contracts/performance.md#reuse-equivalent-work Equal snapshots reuse completed emits only after independent producer admission; a hit proves its inputs once, a publication brackets its build with a second capture. A restored run owns its copied bytes and rebased output ledger; concurrent publishers may duplicate compilation but cannot expose partial documents.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Documents are capped at 128 MiB of raw output bytes plus their index and annex, and join the existing collected single-file cache population. Snapshots and output buffers are invocation-owned; staging removal is attempted in finally and run owners release output. Cleanup or collector failures can retain files; helpers retain no handles or history.
 */
export namespace RuntimeBuildCache {
  const FORMAT = "ttsx-runtime-build-v2";
  const MAX_BYTES = 128 * 1024 * 1024;

  /**
   * Reuse a proven private emit, or invoke the original producer once. Capture
   * returns a deterministic complete input snapshot, or undefined to decline
   * caching. Admission must validate the producer's extra input observations;
   * the second argument is the output root that producer actually used. Cache
   * IO or cache-admission failure costs reuse only. Errors thrown by the
   * original build retain their normal failure policy.
   *
   * @evidence contracts/common.md#principled-implementation Lookup proves one current input snapshot and publication brackets its build with a second, preserving the actual producer result and require explicit extra-input admission; files or a run-owned checksummed bundle are established before the result is rebased.
   * @evidence contracts/common.md#clear-and-simple-design Snapshot, proof and build callbacks expose their independent responsibilities while the operation alone owns storage and restore cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only successful complete emits are published; malformed, oversized, damaged or unproved documents fall through to the caller's real producer without changing compiler selection.
   * @evidence contracts/common.md#meaningful-documentation Native prose states complete-snapshot meaning, producer-root coordinates, callback error policy and recoverable cache IO.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat refuses aliases, path.relative checks containment and native mkdir/write/rename preserve byte payloads and host path semantics.
   * @evidence contracts/performance.md#efficient-algorithms Snapshot owners govern input work; a hit parses the index and annex, copies the document once and hashes its bodies once, with no text encoding of output bytes. Runtime hits place one bundle plus distinct directories instead of all output files; publication walks private fresh output and writes it once.
   * @evidence contracts/performance.md#reuse-equivalent-work A format-and-snapshot digest names one candidate; checksum, output grammar and producer admission are independent reuse gates, and a restore reads no input that a second capture could protect. Every miss calls build once.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Call-local output buffers and the written document are bounded by the 128 MiB admission ceiling; partial restores are unlinked and staging removal is attempted in finally. Collector failures can retain files under the existing cache policy.
   */
  export function run(props: {
    /** Collected single-file cache root, or undefined to bypass persistence. */
    directory?: string;
    /** Empty private output directory owned by this build's caller. */
    emitDir: string;
    /** Source runtime consumers read run-owned bundled outputs lazily. */
    bundle?: boolean;
    /** Selected project, retained in actionable decision observations. */
    project?: string;
    /** Fresh complete input snapshot; undefined preserves ordinary execution. */
    capture: () => string | undefined;
    /** Producer-specific proof, with its original private output root. */
    admit: (result: TtscBuildResult, emitDir: string) => boolean;
    /** Original build operation, including its diagnostic policy. */
    build: () => TtscBuildResult;
  }): TtscBuildResult {
    const report = (
      outcome: string,
      reason?: string,
      key?: string,
      outputs?: number,
      materialized?: number,
      detail?: string,
    ) =>
      RuntimeBuildExplanation.report({
        outcome,
        reason,
        key,
        project: props.project,
        outputs,
        materialized,
        detail,
      });
    if (props.directory === undefined) {
      report("bypassed", "persistence-disabled");
      return props.build();
    }
    let snapshot: string | undefined;
    try {
      snapshot = props.capture();
    } catch {
      /* An unavailable proof is a miss. */
    }
    if (snapshot === undefined) {
      report("ineligible", "input-snapshot-unavailable");
      return props.build();
    }
    const key = digest(FORMAT + "\0" + snapshot);
    const file = path.join(props.directory, key + ".emit");
    const restored: string[] = [];
    let operation = "lookup";
    try {
      const stat = fs.lstatSync(file);
      operation = "document-validation";
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES)
        throw new Error("unusable runtime cache document");
      const document = RuntimeEmitBundle.inspect(file);
      const entry = JSON.parse(document.annex);
      if (
        entry.format !== FORMAT ||
        entry.snapshot !== snapshot ||
        typeof entry.emitDir !== "string" ||
        !path.isAbsolute(entry.emitDir) ||
        entry.result?.status !== 0 ||
        !props.admit(entry.result, entry.emitDir)
      )
        throw new Error("unproved runtime cache document");
      const names = new Set(document.names);
      if (names.size === 0) throw new Error("empty runtime cache document");
      for (const output of Object.keys(entry.result.emittedSources ?? {}))
        if (!names.has(path.relative(entry.emitDir, output)))
          throw new Error("missing runtime cache provenance output");
      operation = "output-restoration";
      const bundleFile = path.join(props.emitDir, RuntimeEmitBundle.filename);
      const bundled =
        props.bundle === true &&
        document.bundleable &&
        RuntimeEmitBundle.restore(file, props.emitDir, document.names);
      if (bundled) {
        // The run owns one complete file, so collection of the persistent
        // document cannot remove an active child's bytes. Opening it verifies
        // every copied body against the index, so a damaged document is a miss
        // here rather than an error in whoever reads the artifact next.
        restored.push(bundleFile);
        if (RuntimeEmitBundle.open(props.emitDir) === undefined)
          throw new Error("restored runtime bundle is missing");
      } else RuntimeEmitBundle.extract(file, props.emitDir, restored);
      // The document's bytes are immutable and checksummed, and the snapshot
      // and admission above proved the inputs at one instant. Restoring reads
      // no input, so a second capture could only move that instant: the run
      // would be as old as its sources either way, at twice the proof's cost
      // (samchon/ttsc#1852). Publication below still brackets the build.
      recordCacheFileUse(file);
      report(
        "reused",
        undefined,
        key,
        document.names.length,
        bundled ? 1 : document.names.length,
      );
      return {
        ...relocate(entry.result, entry.emitDir, props.emitDir),
        ...(bundled ? { bundledOutputs: true as const } : {}),
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      report(
        "miss",
        operation === "lookup" && code === "ENOENT"
          ? "document-missing"
          : operation + "-failed",
        key,
        undefined,
        undefined,
        error instanceof Error ? error.message : String(error),
      );
      for (const output of restored)
        try {
          fs.unlinkSync(output);
        } catch {
          /* Rejected cache output cannot prevent the ordinary producer. */
        }
    }
    const result = props.build();
    if (result.status !== 0) {
      report("not-recorded", "producer-failed", key);
      return result;
    }
    let temporary: string | undefined;
    try {
      const outputs: [string, Buffer][] = [];
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
            if (outputBytes > MAX_BYTES) {
              report("not-recorded", "output-byte-limit", key);
              return result;
            }
            outputs.push([
              path.relative(props.emitDir, target),
              fs.readFileSync(target),
            ]);
          } else throw new Error("nonordinary runtime output");
        }
      }
      if (outputs.length === 0) {
        report("not-recorded", "no-emitted-outputs", key);
        return result;
      }
      const annex = JSON.stringify({
        format: FORMAT,
        snapshot,
        emitDir: props.emitDir,
        result,
      });
      // The index adds a path and a hash per output to the bodies.
      if (
        outputBytes +
          Buffer.byteLength(annex) +
          outputs.reduce(
            (sum, [name]) => sum + Buffer.byteLength(name) + 128,
            0,
          ) >
        MAX_BYTES
      ) {
        report("not-recorded", "document-byte-limit", key);
        return result;
      }
      if (props.capture() !== snapshot) {
        report("not-recorded", "inputs-changed", key);
        return result;
      }
      if (!props.admit(result, props.emitDir)) {
        report("not-recorded", "producer-proof-refused", key);
        return result;
      }
      fs.mkdirSync(props.directory, { recursive: true });
      if (fs.lstatSync(props.directory).isSymbolicLink()) {
        report("not-recorded", "aliased-cache-directory", key);
        return result;
      }
      temporary = path.join(
        props.directory,
        `${key}.${crypto.randomUUID()}.tmp`,
      );
      RuntimeEmitBundle.archive(temporary, outputs, annex);
      fs.renameSync(temporary, file);
      report("recorded", undefined, key, outputs.length, 0);
    } catch {
      report("not-recorded", "cache-publication-io-or-output-failure", key);
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

  /** Hash encoded input or document bytes with SHA-256. */
  function digest(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  /** Admit only a nonempty relative descendant coordinate. */
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

  /** Move producer-owned output coordinates to the current private run. */
  function relocate(
    result: TtscBuildResult,
    previous: string,
    current: string,
  ): TtscBuildResult {
    const { bundledOutputs: _previousBundle, ...producer } = result;
    const move = (output: string): string => {
      const relative = path.relative(previous, output);
      if (!safeRelative(relative))
        throw new Error("runtime provenance escapes its output root");
      return path.join(current, relative);
    };
    return {
      ...producer,
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

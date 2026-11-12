import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { recordCacheFileUse } from "../../../plugin/internal/source/recordCacheFileUse";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { RuntimeBuildExplanation } from "./RuntimeBuildExplanation";
import { RuntimeEmitBundle } from "./RuntimeEmitBundle";

/**
 * Persist completed private runtime emits as checksummed, atomically published
 * documents: a JSON record and, beside it, a raw bundle of the output bytes.
 * Readers copy admitted bytes into their own run directory as files or one lazy
 * runtime bundle, so collection cannot remove an executing emit. Input
 * discovery and producer-proof admission belong to the supplied owners.
 *
 * A stored result is proven in one of two ways. A producer that reports every
 * input observation it made lets the request name its document by everything
 * except the filesystem's state and prove it by replaying those observations,
 * so a hit observes no input to find it and keeps one document per build
 * configuration. Any other producer is named by a complete input snapshot,
 * which is then the proof.
 *
 * @evidence contracts/common.md#principled-implementation Content-addressed snapshots select a checksummed JSON record of the proof and result, with its outputs beside it in the run bundle's own raw layout (RuntimeEmitBundle.archive) and bound to the record by its checksum. SHA-256 consumes exact UTF-8 text and exact output bytes; native normalization rejects absolute, dot, parent and Windows drive-relative output coordinates. Relocation changes producer output coordinates and private-root stream text while retaining source paths.
 * @evidence contracts/common.md#clear-and-simple-design One operation coordinates lookup, proof, restore and publication; RuntimeEmitBundle owns lazy byte representation, while input capture and producer validation remain separate callbacks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Misses execute the original build exactly once; failed or absent proofs never manufacture successful output. Every transported output must be a normalized private descendant, without filename or consumer-name exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes persistent storage, run-owned copies and proof ownership; run states callback stability and failure behavior, and private helper comments identify byte, path and relocation domains.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths, lstat, relative/join and rename own storage and containment, including Windows drive-relative rejection. Source coordinates remain unchanged; transported symlinks are refused rather than followed.
 * @evidence contracts/performance.md#efficient-algorithms Lookup hashes snapshot text, parses the record and reads only the bundle's index. Runtime restoration copies the bundle as the run's own, verifies its bodies once and reserves each distinct output directory; ordinary SDK restoration writes each verified output. Publication scales with output bytes and entries; relocation scans producer paths and streams.
 * @evidence contracts/performance.md#reuse-equivalent-work Equal snapshots reuse completed emits only after independent producer admission; a hit proves its inputs once, a publication brackets its build with a second capture. A restored run owns its copied bytes and rebased output ledger; concurrent publishers may duplicate compilation but cannot expose partial documents.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A record and its bundle are each capped at 128 MiB, and both join the existing collected single-file cache population; a collected half makes the pair a miss. Snapshots and output buffers are invocation-owned; staging removal is attempted in finally and run owners release output. Cleanup or collector failures can retain files; helpers retain no handles or history.
 */
export namespace RuntimeBuildCache {
  const FORMAT = "ttsx-runtime-build-v2";
  const MAX_BYTES = 128 * 1024 * 1024;

  /**
   * Reuse a proven private emit, or invoke the original producer once. Capture
   * returns a deterministic complete input snapshot, or undefined to decline
   * caching. With an identity and a replay, the snapshot is not captured: the
   * identity names the document and the replay proves the stored result, and
   * only a result carrying replayable observations is published under it.
   * Admission must validate the producer's extra input observations; the second
   * argument is the output root that producer actually used. Cache IO or
   * cache-admission failure costs reuse only. Errors thrown by the original
   * build retain their normal failure policy.
   *
   * @evidence contracts/common.md#principled-implementation Lookup proves the stored result once, by an equal input snapshot or by replaying the observations it carries, and publication brackets its build with a second proof, preserving the actual producer result and require explicit extra-input admission; files or a run-owned checksummed bundle are established before the result is rebased.
   * @evidence contracts/common.md#clear-and-simple-design Snapshot, proof and build callbacks expose their independent responsibilities while the operation alone owns storage and restore cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only successful complete emits are published; malformed, oversized, damaged or unproved documents fall through to the caller's real producer without changing compiler selection.
   * @evidence contracts/common.md#meaningful-documentation Native prose states complete-snapshot meaning, producer-root coordinates, callback error policy and recoverable cache IO.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat refuses aliases, path.relative checks containment and native mkdir/write/rename preserve byte payloads and host path semantics.
   * @evidence contracts/performance.md#efficient-algorithms Snapshot owners govern input work; a hit parses the record and the bundle's index, copies the bundle once and hashes its bodies once, with no text encoding of output bytes. Runtime hits place one bundle plus distinct directories instead of all output files; publication walks private fresh output and writes it once.
   * @evidence contracts/performance.md#reuse-equivalent-work A format-and-snapshot digest, or a format-and-identity digest for a replayed proof, names one candidate; checksum, output grammar, producer admission and, where used, the replay of the result's own observations are independent reuse gates, and a restore reads no input that a second capture could protect. Every miss calls build once.
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
    /**
     * Everything that selects the build except the state of the filesystem, or
     * undefined to use `capture`. With it a stored result is found without
     * observing any input and proven by `replay`.
     */
    identity?: () => string | undefined;
    /**
     * Replay the stored result's own input observations against the disk:
     * undefined when every one holds, otherwise the path that moved, or an
     * empty string when the result carries no replayable observations.
     */
    replay?: (result: TtscBuildResult, emitDir: string) => string | undefined;
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
    // A replayed proof needs no input observation to find its document; a
    // snapshot proof is the document's name. Either states what the stored
    // entry must say, how it is proven, and how a fresh build is bracketed.
    let proof: Proof | undefined;
    try {
      const identity =
        props.replay === undefined ? undefined : props.identity?.();
      if (identity !== undefined) {
        const replay = props.replay!;
        proof = {
          text: "replay\0" + identity,
          field: "identity",
          value: identity,
          restores: (result, emitDir) => {
            if (!props.admit(result, emitDir))
              return "unproved runtime cache document";
            const moved = replay(result, emitDir);
            return moved === undefined
              ? undefined
              : "runtime input moved: " + moved;
          },
          publishes: (result) => {
            if (result.compilerObservations === undefined)
              return "compiler-observations-unavailable";
            if (props.identity!() !== identity) return "inputs-changed";
            if (!props.admit(result, props.emitDir))
              return "producer-proof-refused";
            // Nothing moved since the compiler read it, so the observations
            // describe the disk the next lookup will be compared with.
            return replay(result, props.emitDir) === undefined
              ? undefined
              : "inputs-changed";
          },
        };
      } else {
        const snapshot = props.capture();
        if (snapshot !== undefined)
          proof = {
            text: snapshot,
            field: "snapshot",
            value: snapshot,
            restores: (result, emitDir) =>
              props.admit(result, emitDir)
                ? undefined
                : "unproved runtime cache document",
            publishes: (result) =>
              props.capture() !== snapshot
                ? "inputs-changed"
                : props.admit(result, props.emitDir)
                  ? undefined
                  : "producer-proof-refused",
          };
      }
    } catch {
      /* An unavailable proof is a miss. */
    }
    if (proof === undefined) {
      report("ineligible", "input-snapshot-unavailable");
      return props.build();
    }
    const key = digest(FORMAT + "\0" + proof.text);
    // A stored build is two files. The record is checksummed JSON carrying the
    // proof and the producer's result, as it always was, so it stays readable
    // to whoever inspects the directory. The output bytes live beside it in
    // the run bundle's own raw layout, bound to the record by its checksum, so
    // restoring them is one file copy instead of decoding text.
    const file = path.join(props.directory, key + ".json");
    const bodies = path.join(props.directory, key + ".bundle");
    const restored: string[] = [];
    let operation = "lookup";
    try {
      const stat = fs.lstatSync(file);
      operation = "document-validation";
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES)
        throw new Error("unusable runtime cache document");
      const record = JSON.parse(fs.readFileSync(file, "utf8"));
      if (
        record.format !== FORMAT ||
        typeof record.payload !== "string" ||
        record.hash !== digest(record.payload)
      )
        throw new Error("invalid runtime cache checksum");
      const entry = JSON.parse(record.payload);
      const document = RuntimeEmitBundle.inspect(bodies);
      // A bundle published for another record, or left by an interrupted
      // publication, never supplies this record's outputs.
      if (document.annex !== record.hash)
        throw new Error("runtime cache outputs belong to another record");
      if (
        entry[proof.field] !== proof.value ||
        typeof entry.emitDir !== "string" ||
        !path.isAbsolute(entry.emitDir) ||
        entry.result?.status !== 0
      )
        throw new Error("unproved runtime cache document");
      operation = "input-proof";
      const refused = proof.restores(entry.result, entry.emitDir);
      if (refused !== undefined) throw new Error(refused);
      operation = "document-validation";
      const names = new Set(document.names);
      if (names.size === 0) throw new Error("empty runtime cache document");
      for (const output of Object.keys(entry.result.emittedSources ?? {}))
        if (!names.has(path.relative(entry.emitDir, output)))
          throw new Error("missing runtime cache provenance output");
      operation = "output-restoration";
      // Stamped before restoring: a restored bundle can be a link to the same
      // file, whose stamps then stay as its validation saw them.
      recordCacheFileUse(file);
      recordCacheFileUse(bodies);
      const bundleFile = path.join(props.emitDir, RuntimeEmitBundle.filename);
      const bundled =
        props.bundle === true &&
        document.bundleable &&
        RuntimeEmitBundle.restore(bodies, props.emitDir, document.names);
      if (bundled) {
        // The run owns one complete file, so collection of the persistent
        // document cannot remove an active child's bytes. Opening it verifies
        // every copied body against the index, so a damaged document is a miss
        // here rather than an error in whoever reads the artifact next.
        restored.push(bundleFile);
        if (RuntimeEmitBundle.shared(props.emitDir) === undefined)
          throw new Error("restored runtime bundle is missing");
      } else RuntimeEmitBundle.extract(bodies, props.emitDir, restored);
      // The document's bytes are immutable and checksummed, and the proof
      // above held at one instant. Restoring reads no input, so a second proof
      // could only move that instant: the run would be as old as its sources
      // either way, at twice the proof's cost (samchon/ttsc#1852). Publication
      // below still brackets the build.
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
      const payload = JSON.stringify({
        [proof.field]: proof.value,
        emitDir: props.emitDir,
        result,
      });
      const hash = digest(payload);
      const text = JSON.stringify({ format: FORMAT, hash, payload });
      // The index adds a path and a hash per output to the bodies.
      if (
        Buffer.byteLength(text) > MAX_BYTES ||
        outputBytes +
          outputs.reduce(
            (sum, [name]) => sum + Buffer.byteLength(name) + 128,
            0,
          ) >
          MAX_BYTES
      ) {
        report("not-recorded", "document-byte-limit", key);
        return result;
      }
      const unpublishable = proof.publishes(result);
      if (unpublishable !== undefined) {
        report("not-recorded", unpublishable, key);
        return result;
      }
      fs.mkdirSync(props.directory, { recursive: true });
      if (fs.lstatSync(props.directory).isSymbolicLink()) {
        report("not-recorded", "aliased-cache-directory", key);
        return result;
      }
      // The outputs are published first and the record last, so a record is
      // never visible before the bundle it names; a reader that meets a newer
      // bundle under an older record sees the checksum differ and builds.
      const staging = crypto.randomUUID();
      temporary = path.join(props.directory, `${key}.${staging}.bundle.tmp`);
      RuntimeEmitBundle.archive(temporary, outputs, hash);
      fs.renameSync(temporary, bodies);
      temporary = path.join(props.directory, `${key}.${staging}.tmp`);
      fs.writeFileSync(temporary, text, { flag: "wx" });
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

  /**
   * How one request finds and proves a stored result. A replayed proof names
   * its document by everything but the filesystem's state and proves it from
   * the result's own recorded observations; a snapshot proof names it by a
   * complete input snapshot, which is then its whole proof beside admission.
   */
  interface Proof {
    /** Text hashed, with the format, into the document's name. */
    text: string;

    /** Record member that must equal `value` for the document to be this one. */
    field: "identity" | "snapshot";

    /** The identity or snapshot the document was stored under. */
    value: string;

    /** Why a stored result may not be restored now, or undefined. */
    restores(result: TtscBuildResult, emitDir: string): string | undefined;

    /** Why a fresh result may not be published, or undefined. */
    publishes(result: TtscBuildResult): string | undefined;
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
    const prefix = previous + path.sep;
    const move = (output: string): string => {
      // A recorded output spelled below the recorded root is relocated by its
      // spelling; path.relative resolves and folds both paths for each of
      // thousands of outputs, and the result is the same suffix.
      const relative = output.startsWith(prefix)
        ? output.slice(prefix.length)
        : path.relative(previous, output);
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

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { RuntimeTrash } from "../../../internal/RuntimeTrash";
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
 * Storing a fresh build reads every output back and replays its proof, which
 * cost more than the build when it ran before the program started
 * (samchon/ttsc#1859). A caller that runs a program therefore takes the
 * publication and advances it while the program runs. When the program ends
 * first, the build is parked: its output directory moves into the store by one
 * rename, beside a job holding the result and what proving it needs. The next
 * request of the same build proves the parked build and, if it holds, moves its
 * outputs into its own run by another rename, without compiling or reading
 * them; a caller that cannot run a program publishes it in place instead. A
 * parked build is always newer than the stored record of the same request, so
 * it is tried first.
 *
 * @evidence contracts/common.md#principled-implementation Content-addressed snapshots select a checksummed JSON record of the proof and result, with its outputs beside it in the run bundle's own raw layout (RuntimeEmitBundle.archive) and bound to the record by its checksum. A parked build is the same result and outputs, moved whole, with the job the proof needs; adopting one proves it as a record is proven. SHA-256 consumes exact UTF-8 text and exact output bytes; native normalization rejects absolute, dot, parent and Windows drive-relative output coordinates. Relocation changes producer output coordinates and private-root stream text while retaining source paths.
 * @evidence contracts/common.md#clear-and-simple-design One operation coordinates lookup, proof, restore, adoption and publication, and one Publication hands the deferred part to its caller; RuntimeEmitBundle owns lazy byte representation, while input capture and producer validation remain separate callbacks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Misses execute the original build exactly once; failed or absent proofs never manufacture successful output. Every transported output must be a normalized private descendant, without filename or consumer-name exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes persistent storage, run-owned copies and proof ownership; run states callback stability and failure behavior, and private helper comments identify byte, path and relocation domains.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths, lstat, relative/join and rename own storage and containment, including Windows drive-relative rejection. Source coordinates remain unchanged; transported symlinks are refused rather than followed.
 * @evidence contracts/performance.md#efficient-algorithms Lookup hashes snapshot text, parses the record and reads only the bundle's index. Runtime restoration copies the bundle as the run's own, verifies its bodies once and reserves each distinct output directory; ordinary SDK restoration writes each verified output. Parking and adoption are renames independent of output count. Publication scales with output bytes and entries, read eight at a time on the thread pool when deferred; relocation scans producer paths and streams.
 * @evidence contracts/performance.md#reuse-equivalent-work Equal snapshots reuse completed emits only after independent producer admission; a hit proves its inputs once, a publication brackets its build with a second proof, and an adopted parked build, proven by its adoption, is stored without a third. A restored run owns its copied bytes and rebased output ledger; an adopting run owns the moved outputs; concurrent publishers may duplicate compilation but cannot expose partial documents, and only one adopter can take a parked build.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A record and its bundle are each capped at 128 MiB, and both join the existing collected single-file cache population; a collected half makes the pair a miss. Parked builds are discarded by the next request that cannot adopt them and otherwise age out with the collection policy. Snapshots and output buffers are invocation-owned; staging removal is attempted in finally and run owners release output. Cleanup or collector failures can retain files; helpers retain no handles or history.
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
   * build retain their normal failure policy. With `defer`, a fresh or adopted
   * build returns before it is stored and the caller owns its publication.
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
    replay?: (
      result: TtscBuildResult,
      emitDir: string,
      first?: readonly string[],
    ) => string | undefined;
    /** Producer-specific proof, with its original private output root. */
    admit: (result: TtscBuildResult, emitDir: string) => boolean;
    /** Original build operation, including its diagnostic policy. */
    build: () => TtscBuildResult;
    /**
     * Complete a fresh result with the observations its proof needs, at
     * publication; the result returned to the caller does not carry them.
     */
    record?: (result: TtscBuildResult) => TtscBuildResult;
    /** `record` in bounded steps, for a publication run while a program runs. */
    recordSteps?: (result: TtscBuildResult) => Generator<void, TtscBuildResult>;
    /** `replay` in bounded steps, for the same purpose. */
    replaySteps?: (
      result: TtscBuildResult,
      emitDir: string,
      first?: readonly string[],
    ) => Generator<void, string | undefined>;
    /**
     * Take a fresh build's publication instead of running it before return. The
     * caller advances it while the program executes and parks what is left when
     * the program ends first.
     */
    defer?: (publication: Publication) => void;
    /** What publishing a parked build needs from this request, serializable. */
    parked?: () => unknown;
    /** `record` for a parked build, from the state `parked` returned. */
    recordParked?: (result: TtscBuildResult, state: unknown) => TtscBuildResult;
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
    // Inputs that moved in earlier proofs of this request, asked first by the
    // next replay; the record that keeps them is named once the key is known.
    let moved: string[] = [];
    let movedFile: string | undefined;
    const noteMoved = (file: string): void => {
      moved = [file, ...moved.filter((entry) => entry !== file)].slice(0, 16);
      if (movedFile !== undefined)
        try {
          fs.writeFileSync(movedFile, JSON.stringify(moved));
        } catch {
          /* Only the order of a later replay depends on it. */
        }
    };
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
            const changed = replay(result, emitDir, moved);
            if (changed) noteMoved(changed);
            return changed === undefined
              ? undefined
              : "runtime input moved: " + changed;
          },
          publishes: function* (result, emitDir) {
            if (result.compilerObservations === undefined)
              return ["compiler-observations-unavailable"];
            if (props.identity!() !== identity)
              return ["inputs-changed", "build identity changed"];
            if (!props.admit(result, emitDir))
              return ["producer-proof-refused"];
            // Nothing moved since the compiler read it, so the observations
            // describe the disk the next lookup will be compared with.
            yield;
            const changed =
              props.replaySteps === undefined
                ? replay(result, emitDir, moved)
                : yield* props.replaySteps(result, emitDir, moved);
            if (changed) noteMoved(changed);
            return changed === undefined
              ? undefined
              : ["inputs-changed", "runtime input moved: " + changed];
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
            publishes: (result, emitDir) =>
              lift(
                props.capture() !== snapshot
                  ? (["inputs-changed", "input snapshot changed"] as const)
                  : props.admit(result, emitDir)
                    ? undefined
                    : (["producer-proof-refused"] as const),
              ),
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
    const directory = props.directory;
    // A stored build is two files. The record is checksummed JSON carrying the
    // proof and the producer's result, as it always was, so it stays readable
    // to whoever inspects the directory. The output bytes live beside it in
    // the run bundle's own raw layout, bound to the record by its checksum, so
    // restoring them is one file copy instead of decoding text.
    const file = path.join(directory, key + ".json");
    const bodies = path.join(directory, key + ".bundle");
    // Builds whose publication their run did not finish, each with its outputs
    // and what publishing them still needs (`park`).
    const parkedRoot = path.join(directory, key + ".pending");
    movedFile = path.join(directory, key + ".moved.json");
    try {
      const recorded: unknown = JSON.parse(fs.readFileSync(movedFile, "utf8"));
      if (
        Array.isArray(recorded) &&
        recorded.every((entry) => typeof entry === "string")
      )
        moved = recorded as string[];
    } catch {
      /* No input of this request has moved yet. */
    }
    const lookup = (): TtscBuildResult | undefined => {
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
          entry[proof!.field] !== proof!.value ||
          typeof entry.emitDir !== "string" ||
          !path.isAbsolute(entry.emitDir) ||
          entry.result?.status !== 0
        )
          throw new Error("unproved runtime cache document");
        operation = "input-proof";
        const refused = proof!.restores(entry.result, entry.emitDir);
        if (refused !== undefined) throw new Error(refused);
        operation = "document-validation";
        const names = new Set(document.names);
        if (names.size === 0) throw new Error("empty runtime cache document");
        for (const output of Object.keys(entry.result.emittedSources ?? {}))
          if (!names.has(path.relative(entry.emitDir, output)))
            throw new Error("missing runtime cache provenance output");
        operation = "output-restoration";
        // Stamped before restoring: a restored bundle can be a link to the
        // same file, whose stamps then stay as its validation saw them.
        recordCacheFileUse(file);
        recordCacheFileUse(bodies);
        const bundleFile = path.join(props.emitDir, RuntimeEmitBundle.filename);
        const bundled =
          props.bundle === true &&
          document.bundleable &&
          RuntimeEmitBundle.restore(bodies, props.emitDir, document.names);
        if (bundled) {
          // The run owns one complete file, so collection of the persistent
          // document cannot remove an active child's bytes. Opening it
          // verifies every copied body against the index, so a damaged
          // document is a miss here rather than an error in whoever reads the
          // artifact next.
          restored.push(bundleFile);
          if (RuntimeEmitBundle.shared(props.emitDir) === undefined)
            throw new Error("restored runtime bundle is missing");
        } else RuntimeEmitBundle.extract(bodies, props.emitDir, restored);
        // The document's bytes are immutable and checksummed, and the proof
        // above held at one instant. Restoring reads no input, so a second
        // proof could only move that instant: the run would be as old as its
        // sources either way, at twice the proof's cost (samchon/ttsc#1852).
        // Publication still brackets the build.
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
        return undefined;
      }
    };
    /**
     * Publish `result`, built with its outputs under `emitDir` and now found
     * under `outputs`, one bounded step per iteration. The generator returns
     * whether a record was written; every refusal is reported where it occurs.
     */
    function* publication(
      fresh: TtscBuildResult,
      emitDir: string,
      outputs: string,
      record: (result: TtscBuildResult) => Generator<void, TtscBuildResult>,
      options: {
        /** Called once `record` completed. */
        onRecorded?: (result: TtscBuildResult) => void;
        /**
         * The result's inputs were proven just now, by the lookup that adopted
         * it, so publication does not prove them a second time.
         */
        proven?: boolean;
        /** Read the outputs on the thread pool; the caller awaits the yield. */
        parallel?: boolean;
      } = {},
    ): Generator<void | Promise<unknown>, boolean> {
      const result = yield* record(fresh);
      options.onRecorded?.(result);
      yield;
      const unpublishable =
        options.proven === true
          ? undefined
          : yield* proof!.publishes(result, emitDir);
      if (unpublishable !== undefined) {
        report(
          "not-recorded",
          unpublishable[0],
          key,
          undefined,
          undefined,
          unpublishable[1],
        );
        return false;
      }
      yield;
      const names: string[] = [];
      const pending = [outputs];
      while (pending.length !== 0) {
        const current = pending.pop()!;
        for (const child of fs.readdirSync(current, { withFileTypes: true })) {
          const target = path.join(current, child.name);
          if (child.isSymbolicLink()) throw new Error("aliased runtime output");
          if (child.isDirectory()) pending.push(target);
          else if (child.isFile()) names.push(target);
          else throw new Error("nonordinary runtime output");
        }
      }
      // Reading thousands of outputs is the longest part of a publication.
      // A run that publishes while its program executes reads them eight at a
      // time on the thread pool, a third of the time one by one took on
      // Windows, where each open pays the filesystem filter stack; an inline
      // publication reads them in batches it can stop between.
      const files: [string, Buffer][] = new Array(names.length);
      if (options.parallel === true)
        for (let start = 0; start < names.length; start += 512) {
          const end = Math.min(names.length, start + 512);
          let next = start;
          let failure: unknown;
          yield Promise.all(
            Array.from({ length: Math.min(8, end - start) }, async () => {
              while (next < end && failure === undefined) {
                const index = next++;
                try {
                  files[index] = [
                    path.relative(outputs, names[index]!),
                    await fs.promises.readFile(names[index]!),
                  ];
                } catch (error) {
                  failure ??= error;
                }
              }
            }),
          );
          if (failure !== undefined) throw failure;
        }
      else
        for (let index = 0; index < names.length; ++index) {
          files[index] = [
            path.relative(outputs, names[index]!),
            fs.readFileSync(names[index]!),
          ];
          if ((index + 1) % 256 === 0) yield;
        }
      const outputBytes = files.reduce(
        (sum, [, bytes]) => sum + bytes.length,
        0,
      );
      if (outputBytes > MAX_BYTES) {
        report("not-recorded", "output-byte-limit", key);
        return false;
      }
      if (files.length === 0) {
        report("not-recorded", "no-emitted-outputs", key);
        return false;
      }
      const payload = JSON.stringify({
        [proof!.field]: proof!.value,
        emitDir,
        result,
      });
      const hash = digest(payload);
      const text = JSON.stringify({ format: FORMAT, hash, payload });
      // The index adds a path and a hash per output to the bodies.
      if (
        Buffer.byteLength(text) > MAX_BYTES ||
        outputBytes +
          files.reduce(
            (sum, [name]) => sum + Buffer.byteLength(name) + 128,
            0,
          ) >
          MAX_BYTES
      ) {
        report("not-recorded", "document-byte-limit", key);
        return false;
      }
      yield;
      fs.mkdirSync(directory, { recursive: true });
      if (fs.lstatSync(directory).isSymbolicLink()) {
        report("not-recorded", "aliased-cache-directory", key);
        return false;
      }
      // The outputs are published first and the record last, so a record is
      // never visible before the bundle it names; a reader that meets a newer
      // bundle under an older record sees the checksum differ and builds.
      const staging = crypto.randomUUID();
      let temporary: string | undefined = path.join(
        directory,
        `${key}.${staging}.bundle.tmp`,
      );
      try {
        RuntimeEmitBundle.archive(temporary, files, hash);
        fs.renameSync(temporary, bodies);
        temporary = path.join(directory, `${key}.${staging}.tmp`);
        fs.writeFileSync(temporary, text, { flag: "wx" });
        fs.renameSync(temporary, file);
        temporary = undefined;
      } finally {
        if (temporary !== undefined)
          try {
            fs.unlinkSync(temporary);
          } catch {
            /* Rename or later collection owns it. */
          }
      }
      report("recorded", undefined, key, files.length, 0);
      return true;
    }
    /** Drive a publication to its end, reporting an IO failure as refusal. */
    const finish = (
      steps: Generator<void | Promise<unknown>, boolean>,
    ): boolean => {
      try {
        for (;;) {
          const next = steps.next();
          if (next.done === true) return next.value;
        }
      } catch {
        report("not-recorded", "cache-publication-io-or-output-failure", key);
        return false;
      }
    };
    /**
     * Hand `result`, whose outputs are under `props.emitDir`, to the caller
     * that runs the program first: it is stored while the program executes, and
     * parked when the program ends first. `state` is what completing it in
     * another process needs; a recorded result carries its observations already
     * and needs none.
     */
    const defer = (
      result: TtscBuildResult,
      record: (result: TtscBuildResult) => Generator<void, TtscBuildResult>,
      state: unknown,
      recorded: boolean,
      carried?: {
        /** The adopted parked directory, moved into the run beside its outputs. */
        directory: string;
        /** A job to write over the carried one; undefined keeps it. */
        job?: unknown;
      },
    ): void => {
      // A record step that finished before the program ended is kept: the
      // parked build then carries its observations, and the request that
      // adopts it replays them instead of hashing its inputs again.
      const steps = publication(result, props.emitDir, props.emitDir, record, {
        onRecorded: (completed) => {
          result = completed;
          recorded = true;
          state = undefined;
        },
        // An adopted build was proven by the lookup that adopted it.
        proven: carried !== undefined,
        parallel: true,
      });
      let settled = false;
      props.defer!({
        step: () => {
          if (settled) return true;
          try {
            const next = steps.next();
            if (next.done === true) return (settled = true);
            return next.value instanceof Promise
              ? next.value.then(
                  () => undefined,
                  () => undefined,
                )
              : false;
          } catch {
            report(
              "not-recorded",
              "cache-publication-io-or-output-failure",
              key,
            );
            return (settled = true);
          }
        },
        request: () => {
          if (settled) return undefined;
          settled = true;
          report("parked", undefined, key);
          const parked = path.join(
            parkedRoot,
            `${Date.now()}-${process.pid}-${crypto.randomUUID()}`,
          );
          return carried !== undefined
            ? {
                outputs: props.emitDir,
                parked,
                carried: carried.directory,
                job: carried.job,
              }
            : {
                outputs: props.emitDir,
                parked,
                job: {
                  format: PARKED_FORMAT,
                  [proof!.field]: proof!.value,
                  emitDir: props.emitDir,
                  result,
                  recorded,
                  state,
                },
              };
        },
        park() {
          const request = this.request();
          if (request !== undefined && !park(request))
            report(
              "not-recorded",
              "cache-publication-io-or-output-failure",
              key,
            );
        },
      });
    };
    // A parked build of this request is proven now, when it is needed. A
    // caller that runs the program takes its outputs by one rename, as a fresh
    // build would have left them, and stores or parks them again; another
    // caller publishes it. Both cost less than compiling again. A parked build
    // whose inputs have moved since is refused like any other and discarded.
    if (props.recordParked !== undefined) {
      let names: string[] = [];
      try {
        names = fs.readdirSync(parkedRoot).sort().reverse();
      } catch {
        /* Nothing is parked. */
      }
      let adopted: TtscBuildResult | undefined;
      let carried: { directory: string; job?: unknown } | undefined;
      let published = false;
      for (const name of names) {
        const parked = path.join(parkedRoot, name);
        if (adopted === undefined && !published)
          try {
            const job = JSON.parse(
              fs.readFileSync(path.join(parked, "job.json"), "utf8"),
            );
            if (
              job.format === PARKED_FORMAT &&
              job[proof.field] === proof.value &&
              typeof job.emitDir === "string" &&
              path.isAbsolute(job.emitDir) &&
              job.result?.status === 0
            ) {
              const outputs = path.join(parked, "outputs");
              if (props.defer === undefined)
                published = finish(
                  publication(job.result, job.emitDir, outputs, (result) =>
                    lift(
                      job.recorded === true
                        ? result
                        : props.recordParked!(result, job.state),
                    ),
                  ),
                );
              else {
                const result: TtscBuildResult =
                  job.recorded === true
                    ? job.result
                    : props.recordParked(job.result, job.state);
                const refused = proof.restores(result, job.emitDir);
                if (refused !== undefined)
                  report(
                    "miss",
                    "parked-input-proof-failed",
                    key,
                    undefined,
                    undefined,
                    refused,
                  );
                else {
                  // The run's output directory is empty until a build fills
                  // it. The parked directory moves into the run whole, its
                  // outputs take the output directory's place, and parking
                  // again moves both back without rewriting the job, unless
                  // this adoption recorded the observations it lacked.
                  const directory = `${props.emitDir}.parked`;
                  fs.rmdirSync(props.emitDir);
                  fs.renameSync(parked, directory);
                  fs.renameSync(path.join(directory, "outputs"), props.emitDir);
                  carried = {
                    directory,
                    job:
                      job.recorded === true
                        ? undefined
                        : { ...job, result, recorded: true, state: undefined },
                  };
                  adopted = relocate(result, job.emitDir, props.emitDir);
                  report("reused", "parked", key);
                }
              }
            }
          } catch {
            /* A torn or concurrently taken parked build is discarded. */
            fs.mkdirSync(props.emitDir, { recursive: true });
          }
        if (fs.existsSync(parked) && !RuntimeTrash.retire(parked, directory))
          try {
            fs.rmSync(parked, { force: true, recursive: true });
          } catch {
            /* Collection owns what cannot be removed now. */
          }
      }
      if (adopted !== undefined) {
        defer(adopted, lift, undefined, true, carried);
        return adopted;
      }
    }
    // A parked build is newer than the stored record of the same request, so
    // it is tried first; the record still serves when no parked build does.
    const reused = lookup();
    if (reused !== undefined) return reused;
    const result = props.build();
    if (result.status !== 0) {
      report("not-recorded", "producer-failed", key);
      return result;
    }
    const record =
      props.recordSteps ??
      ((fresh: TtscBuildResult) => lift(props.record?.(fresh) ?? fresh));
    if (props.defer === undefined) {
      finish(publication(result, props.emitDir, props.emitDir, record));
      return result;
    }
    // What parking needs is taken now, before a step consumes it.
    defer(result, record, props.parked?.(), false);
    return result;
  }

  /**
   * A fresh build's publication, handed to a caller that runs the program first
   * (`run`'s `defer`).
   *
   * @evidence contracts/common.md#principled-implementation Steps run the same proof, read and write as an inline publication; parking keeps the unrecorded result, its outputs and the proof state for a later request instead of dropping the work.
   * @evidence contracts/common.md#clear-and-simple-design Two operations: advance one bounded step, or set the rest aside.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A step never publishes before the build's proof holds, and parking never claims a record.
   * @evidence contracts/common.md#meaningful-documentation Members state when to call them and what they do with the outputs.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The interface performs no native operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The interface runs no algorithm; run states the steps.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The interface grants no reuse.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the publication until it finishes or parks, and must do one or the other before its output directory goes.
   */
  export interface Publication {
    /**
     * Run one bounded step: true once the publication finished, with or without
     * a record; false to be called again; or a promise of reads on the thread
     * pool to await before calling again.
     *
     * @evidence contracts/common.md#principled-implementation A step runs the next bounded part of the same proof, read and write an inline publication runs; true means a record was written or refused.
     * @evidence contracts/common.md#clear-and-simple-design Three results tell the caller whether to stop, call again or await reads first.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts A failing step reports the refusal and finishes; it never writes a partial record.
     * @evidence contracts/common.md#meaningful-documentation The prose states each result's meaning.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation The signature performs no native operation; run's publication does.
     * @evidenceExclude contracts/performance.md#efficient-algorithms The signature runs no algorithm; run states the step sizes.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature grants no reuse.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The publication's owner holds it; run states what a step retains.
     */
    step(): boolean | Promise<void>;

    /**
     * Move the unfinished publication's outputs into the store by one rename,
     * with what publishing them still needs. Call after the program ended and
     * before the output directory is removed; a finished publication ignores
     * it.
     *
     * @evidence contracts/common.md#principled-implementation Parking is request followed by park, so the two paths move outputs the same way.
     * @evidence contracts/common.md#clear-and-simple-design One call for a caller that owns the outputs itself.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed move reports the refusal; the outputs then go with their run.
     * @evidence contracts/common.md#meaningful-documentation The prose states when to call it.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation The signature performs no native operation; park does.
     * @evidenceExclude contracts/performance.md#efficient-algorithms The signature runs no algorithm.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature grants no reuse.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The parked build's lifetime is the store's.
     */
    park(): void;

    /**
     * What {@link park} would do, for a process that cannot move the outputs
     * itself because others of its run may still read them; the run's owner
     * performs it with {@link park} once none does. Undefined once the
     * publication finished; either call ends it.
     *
     * @evidence contracts/common.md#principled-implementation The request carries exactly what park writes and moves, so performing it later in another process parks the same build.
     * @evidence contracts/common.md#clear-and-simple-design One serializable value separates deciding to park from moving the outputs.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts A finished publication returns nothing, so a stored build is never parked as well.
     * @evidence contracts/common.md#meaningful-documentation The prose states the cross-process use and the end of the publication.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation The signature performs no native operation.
     * @evidenceExclude contracts/performance.md#efficient-algorithms The signature runs no algorithm.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature grants no reuse.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The request is a value the caller writes or performs.
     */
    request(): ParkRequest | undefined;
  }

  /**
   * One parked build to move into the store: the output directory, the
   * directory it becomes part of, and the job that publishing it needs.
   *
   * @evidence contracts/common.md#principled-implementation Plain JSON fields, so a request crosses processes as a file.
   * @evidence contracts/common.md#clear-and-simple-design Three fields name the move and its description.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The job is opaque here; only the store reads it back.
   * @evidence contracts/common.md#meaningful-documentation Members state their role.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation A data shape performs no native operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A data shape runs no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A data shape grants no reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A data shape holds no resource.
   */
  export interface ParkRequest {
    /** The build's output directory, moved whole. */
    outputs: string;

    /** The parked build's directory in the store. */
    parked: string;

    /**
     * An adopted parked directory carried in the run, holding its job; it moves
     * back whole. Undefined for a fresh build.
     */
    carried?: string;

    /**
     * What publishing the parked build needs, written beside the outputs, or
     * undefined to keep the carried directory's job.
     */
    job?: unknown;
  }

  /**
   * Directory of a ttsx run where its processes leave park requests
   * ({@link Publication.request}) for the launcher.
   */
  export const PARKS_DIRNAME = "parks";

  /**
   * Perform every park request the processes of a run left in it. The run's
   * owner calls this once no process of the run remains, before the run's
   * directory goes.
   *
   * @param runDir The run's directory.
   * @evidence contracts/common.md#principled-implementation Each request names outputs inside the run, which no process reads any more when the owner calls this.
   * @evidence contracts/common.md#clear-and-simple-design One listing and one park per request.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A malformed request is skipped; its outputs go with the run.
   * @evidence contracts/common.md#meaningful-documentation The prose states when to call it.
   * @evidence contracts/portability.md#os-neutral-implementation Native readdir and read.
   * @evidence contracts/performance.md#efficient-algorithms One small JSON read and one park per request.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Parking is an effect.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained.
   */
  export function parkRequested(runDir: string): void {
    const parks = path.join(runDir, PARKS_DIRNAME);
    let names: string[];
    try {
      names = fs.readdirSync(parks);
    } catch {
      return;
    }
    for (const name of names)
      try {
        const request = JSON.parse(
          fs.readFileSync(path.join(parks, name), "utf8"),
        ) as Partial<ParkRequest>;
        if (
          typeof request.outputs === "string" &&
          typeof request.parked === "string" &&
          path.isAbsolute(request.outputs) &&
          path.isAbsolute(request.parked)
        )
          park(request as ParkRequest);
      } catch {
        /* A torn request leaves its outputs to the run. */
      }
  }

  /**
   * Perform a park request: write its job, then move its outputs beside it by
   * one rename. A failure removes the partial parked directory.
   *
   * @param request A request from {@link Publication.request}.
   * @returns Whether the build was parked.
   * @evidence contracts/common.md#principled-implementation The job is written before the outputs arrive, and a reader takes only a directory with both; a rename keeps the move O(1).
   * @evidence contracts/common.md#clear-and-simple-design One function serves the launcher's own publication and requests left by its program's processes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed move leaves nothing parked and reports false; the outputs then go with their run.
   * @evidence contracts/common.md#meaningful-documentation The prose states the order and the failure effect.
   * @evidence contracts/portability.md#os-neutral-implementation Native mkdir, write and rename within the cache root's volume.
   * @evidence contracts/performance.md#efficient-algorithms One job write and one rename, independent of the number of outputs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Parking is an effect.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The parked directory lives in the store until a request adopts or discards it, or collection removes it.
   */
  export function park(request: ParkRequest): boolean {
    try {
      if (request.carried !== undefined) {
        // The adopted directory goes back whole; its job is rewritten only
        // when the adoption recorded what the job lacked.
        if (request.job !== undefined)
          fs.writeFileSync(
            path.join(request.carried, "job.json"),
            JSON.stringify(request.job),
          );
        fs.renameSync(request.outputs, path.join(request.carried, "outputs"));
        fs.mkdirSync(path.dirname(request.parked), { recursive: true });
        fs.renameSync(request.carried, request.parked);
        return true;
      }
      fs.mkdirSync(request.parked, { recursive: true });
      fs.writeFileSync(
        path.join(request.parked, "job.json"),
        JSON.stringify(request.job),
      );
      fs.renameSync(request.outputs, path.join(request.parked, "outputs"));
      return true;
    } catch {
      if (request.carried !== undefined) return false;
      try {
        fs.rmSync(request.parked, { force: true, recursive: true });
      } catch {
        /* Collection owns what cannot be removed now. */
      }
      return false;
    }
  }

  const PARKED_FORMAT = "ttsx-runtime-parked-v1";

  /** A value as a publication step sequence with no step of its own. */
  // eslint-disable-next-line require-yield
  function* lift<T>(value: T): Generator<void, T> {
    return value;
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

    /**
     * Why a fresh result may not be published, as a reason and an optional
     * detail naming what moved, or undefined.
     */
    publishes(
      result: TtscBuildResult,
      emitDir: string,
    ): Generator<void, readonly [reason: string, detail?: string] | undefined>;
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

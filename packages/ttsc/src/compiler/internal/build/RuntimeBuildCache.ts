import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { RuntimeTrash } from "../../../internal/RuntimeTrash";
import { systemTempOutsideProject } from "../../../internal/systemTempOutsideProject";
import { RuntimeProjectMarker } from "../../../launcher/internal/runtime/RuntimeProjectMarker";
import { readDependencyCache } from "../../../launcher/internal/runtime/readDependencyCache";
import { readPosixDirectoryEntries } from "../../../plugin/internal/source/readPosixDirectoryEntries";
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
 * configuration. Either name is further split by the environment variables the
 * build's plugins recorded reading: a build is stored and parked under the
 * values of exactly the variables it read, and the variable sets builds of a
 * name read are registered beside its documents, so every value keeps its own
 * build. Any other producer is named by a complete input snapshot, which is
 * then the proof.
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
 * @evidence contracts/performance.md#efficient-algorithms Lookup hashes snapshot text, lists the identity's registered variable sets and probes one document per set, parses the found record and reads only the bundle's index. Runtime restoration copies the bundle as the run's own, verifies its bodies once and reserves each distinct output directory; ordinary SDK restoration writes each verified output. Parking and adoption are renames independent of output count. Publication scales with output bytes and entries, read eight at a time on the thread pool when deferred; relocation scans producer paths and streams.
 * @evidence contracts/performance.md#reuse-equivalent-work Equal snapshots reuse completed emits only after independent producer admission; a hit proves its inputs once, a publication brackets its build with a second proof, and an adopted parked build, proven by its adoption, is stored without a third. A restored run owns its copied bytes and rebased output ledger; an adopting run owns the moved outputs; concurrent publishers may duplicate compilation but cannot expose partial documents, and only one adopter can take a parked build.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A record and its bundle are each capped at 128 MiB, and both join the existing collected single-file cache population; a collected half makes the pair a miss. Each variable set an identity registered is one immutable file of variable names in the same population, touched by every hit it selects; collecting a set leaves its builds unreachable until a build of those values registers it again. Parked builds are discarded by the next request that cannot adopt them and otherwise age out with the collection policy. Snapshots and output buffers are invocation-owned; staging removal is attempted in finally and run owners release output. Cleanup or collector failures can retain files; helpers retain no handles or history.
 */
export namespace RuntimeBuildCache {
  const FORMAT = "ttsx-runtime-build-v2";
  const MAX_BYTES = 128 * 1024 * 1024;

  /**
   * Reuse a proven private emit, or invoke the original producer once. Capture
   * returns a deterministic complete input snapshot, or undefined to decline
   * caching. With an identity and a replay, the snapshot is not captured: the
   * identity names the request and the replay proves the stored result, and
   * only a result carrying replayable observations is published under it.
   * Either name holds one document per value of the environment variables a
   * build recorded reading, read through `environmentValue`. Admission must
   * validate the producer's extra input observations; the second argument is
   * the output root that producer actually used. Cache IO or cache-admission
   * failure costs reuse only. Errors thrown by the original build retain their
   * normal failure policy. With `defer`, a fresh or adopted build returns
   * before it is stored and the caller owns its publication. With `parkIn`, the
   * run owner receives the park request through the private run directory,
   * before any adoption takes a build from the store.
   *
   * @evidence contracts/common.md#principled-implementation Lookup proves the stored result once, by an equal input snapshot or by replaying the observations it carries, and publication brackets its build with a second proof, preserving the actual producer result and require explicit extra-input admission; files or a run-owned checksummed bundle are established before the result is rebased.
   * @evidence contracts/common.md#clear-and-simple-design Snapshot, proof and build callbacks expose their independent responsibilities while the operation alone owns storage and restore cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only successful complete emits are published; malformed, oversized, damaged or unproved documents fall through to the caller's real producer without changing compiler selection.
   * @evidence contracts/common.md#meaningful-documentation Native prose states complete-snapshot meaning, producer-root coordinates, callback error policy and recoverable cache IO.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat refuses aliases, path.relative checks containment and native mkdir/write/rename preserve byte payloads and host path semantics.
   * @evidence contracts/performance.md#efficient-algorithms Snapshot owners govern input work; a hit parses the record and the bundle's index, copies the bundle once and hashes its bodies once, with no text encoding of output bytes. Runtime hits place one bundle plus distinct directories instead of all output files; publication walks private fresh output and writes it once.
   * @evidence contracts/performance.md#reuse-equivalent-work A format-and-snapshot digest, or a format-and-identity digest for a replayed proof, names the request, and each variable set its builds registered, with the current values, names one candidate document; checksum, output grammar, producer admission and, where used, the replay of the result's own observations are independent reuse gates, and a restore reads no input that a second capture could protect. Every miss calls build once.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Call-local output buffers and the written document are bounded by the 128 MiB admission ceiling; partial restores are unlinked and staging removal is attempted in finally. Collector failures can retain files under the existing cache policy.
   */
  export function run(props: {
    /** Collected single-file cache root, or undefined to bypass persistence. */
    directory?: string;
    /** Current project boundary for a system build store and its run. */
    canChange?: (directory: string) => boolean;
    /** Qualified run containing this build's isolated output. */
    runDir?: string;
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
    /** Owned run directory whose launcher parks this process's builds. */
    parkIn?: string;
    /** What publishing a parked build needs from this request, serializable. */
    parked?: () => unknown;
    /** `record` for a parked build, from the state `parked` returned. */
    recordParked?: (result: TtscBuildResult, state: unknown) => TtscBuildResult;
    /**
     * The value a variable has in the environment the build's processes run
     * under. A plugin's recorded reads of such variables select the document,
     * so each value keeps its own build (samchon/ttsc#1870).
     */
    environmentValue?: (name: string) => string | undefined;
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
          if (props.canChange === undefined)
            fs.writeFileSync(movedFile, JSON.stringify(moved));
          else if (
            props.canChange(path.dirname(movedFile)) &&
            fs
              .lstatSync(movedFile, { throwIfNoEntry: false })
              ?.isSymbolicLink() !== true
          ) {
            const temporary = movedFile + "." + crypto.randomUUID() + ".tmp";
            try {
              fs.writeFileSync(temporary, JSON.stringify(moved), {
                flag: "wx",
              });
              fs.renameSync(temporary, movedFile);
            } finally {
              if (props.canChange(path.dirname(temporary)))
                fs.rmSync(temporary, { force: true });
            }
          }
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
    const directory = props.directory;
    if (props.canChange?.(directory) === false) return props.build();
    const launcherAdopts =
      props.canChange !== undefined &&
      props.parkIn === undefined &&
      props.defer !== undefined;
    const parkReceiptRun = launcherAdopts ? props.runDir : props.parkIn;
    const requiresParkReceipt =
      props.canChange !== undefined && parkReceiptRun !== undefined;
    if (
      (launcherAdopts && parkReceiptRun === undefined) ||
      (parkReceiptRun !== undefined &&
        props.canChange?.(path.join(parkReceiptRun, PARKS_DIRNAME)) === false)
    )
      return props.build();
    // A plugin's environment reads are reported by its build, after the
    // request is named, so they cannot name the request's document. Each build
    // is stored and parked under the identity and the values of exactly the
    // variables it read, and every variable set a build of this identity read
    // is registered beside its documents, one immutable file per set. A request
    // tries each registered set with its current values, so every value of a
    // read variable keeps its own build, a newly read variable leaves the
    // builds of other sets reachable, and concurrent runs cannot unregister one
    // another's sets (samchon/ttsc#1870). A build that read no declared
    // variable is stored under the identity itself.
    const identity = digest(FORMAT + "\0" + proof.text);
    const sets = path.join(directory, identity + ".environment");
    const keyOf = (names: readonly string[]): string =>
      environmentKey(
        identity,
        names.map((name) => [name, props.environmentValue?.(name) ?? null]),
      );
    /** The variables `result`'s plugins recorded reading, name-ordered. */
    const readNames = (result: TtscBuildResult): string[] =>
      Object.keys(result.environmentInputs ?? {}).sort();
    /** Register `names` as a variable set some build of this identity read. */
    const register = (names: readonly string[]): void => {
      if (names.length === 0 || props.canChange?.(sets) === false) return;
      const file = path.join(sets, digest(JSON.stringify(names)) + ".json");
      // One set is always the same bytes, so an existing file is final.
      if (fs.existsSync(file)) return;
      // Collection removes an emptied set directory, so a write that lost it
      // between creating it and renaming into it tries once more.
      for (let attempt = 0; attempt < 2; ++attempt) {
        const temporary = path.join(sets, `${crypto.randomUUID()}.tmp`);
        try {
          fs.mkdirSync(sets, { recursive: true });
          fs.writeFileSync(temporary, JSON.stringify(names), { flag: "wx" });
          fs.renameSync(temporary, file);
          return;
        } catch {
          try {
            fs.unlinkSync(temporary);
          } catch {
            /* Never written, or collection owns it. */
          }
        }
      }
    };
    // The keys this request can be stored under: each registered set with its
    // current values, most recently used first, then the identity itself.
    const candidates: { key: string; set?: string }[] = [];
    try {
      const registered: { names: string[]; set: string; used: number }[] = [];
      for (const name of props.canChange?.(sets) === false
        ? []
        : fs.readdirSync(sets)) {
        if (!name.endsWith(".json")) continue;
        const set = path.join(sets, name);
        try {
          if (props.canChange !== undefined && !fs.lstatSync(set).isFile())
            continue;
          const names: unknown = JSON.parse(fs.readFileSync(set, "utf8"));
          if (
            Array.isArray(names) &&
            names.length !== 0 &&
            names.every((entry) => typeof entry === "string")
          )
            registered.push({
              names: [...new Set(names as string[])].sort(),
              set,
              used: fs.statSync(set).mtimeMs,
            });
        } catch {
          /* Collected or torn: its builds are tried under another set or not. */
        }
      }
      for (const entry of registered.sort((a, b) => b.used - a.used))
        candidates.push({ key: keyOf(entry.names), set: entry.set });
    } catch {
      /* No build of this identity has registered a variable set yet. */
    }
    candidates.push({ key: identity });
    const key = candidates[0]!.key;
    // A stored build is two files. The record is checksummed JSON carrying the
    // proof and the producer's result, as it always was, so it stays readable
    // to whoever inspects the directory. The output bytes live beside it in
    // the run bundle's own raw layout, bound to the record by its checksum, so
    // restoring them is one file copy instead of decoding text. Builds whose
    // publication their run did not finish are parked beside them, each with
    // its outputs and what publishing them still needs (`park`).
    const documentOf = (key: string) => ({
      file: path.join(directory, key + ".json"),
      bodies: path.join(directory, key + ".bundle"),
      parked: path.join(directory, key + ".pending"),
    });
    const parkDestination = (key: string): string =>
      path.join(
        documentOf(key).parked,
        `${Date.now()}-${process.pid}-${crypto.randomUUID()}`,
      );
    movedFile = path.join(directory, identity + ".moved.json");
    try {
      const recorded: unknown =
        props.canChange !== undefined && !fs.lstatSync(movedFile).isFile()
          ? undefined
          : JSON.parse(fs.readFileSync(movedFile, "utf8"));
      if (
        Array.isArray(recorded) &&
        recorded.every((entry) => typeof entry === "string")
      )
        moved = recorded as string[];
    } catch {
      /* No input of this request has moved yet. */
    }
    /**
     * Restore the stored build of `candidate`, or report why it cannot serve. A
     * candidate with no document answers `"missing"` without a report, so a
     * request reports one miss for all of its candidates.
     */
    const lookup = (candidate: {
      key: string;
      set?: string;
    }): TtscBuildResult | "missing" | undefined => {
      const { key } = candidate;
      const { file, bodies } = documentOf(key);
      const restored: string[] = [];
      let operation = "lookup";
      try {
        if (props.canChange?.(directory) === false) return "missing";
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
        if (props.canChange !== undefined && !fs.lstatSync(bodies).isFile())
          throw new Error("aliased runtime cache outputs");
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
        if (
          props.canChange !== undefined &&
          !canMoveTree(props.emitDir, props.canChange)
        )
          throw new Error("unsafe runtime restore destination");
        // Stamped before restoring: a restored bundle can be a link to the
        // same file, whose stamps then stay as its validation saw them.
        recordCacheFileUse(file);
        recordCacheFileUse(bodies);
        if (candidate.set !== undefined) recordCacheFileUse(candidate.set);
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
        for (const output of restored)
          try {
            fs.unlinkSync(output);
          } catch {
            /* Rejected cache output cannot prevent the ordinary producer. */
          }
        if (operation === "lookup" && code === "ENOENT") return "missing";
        report(
          "miss",
          operation + "-failed",
          key,
          undefined,
          undefined,
          error instanceof Error ? error.message : String(error),
        );
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
        markerProofs?: RuntimeProjectMarker.Proofs;
      } = {},
    ): Generator<void | Promise<unknown>, boolean> {
      const result = yield* record(fresh);
      options.onRecorded?.(result);
      // The document is named by the values of exactly the variables this
      // build read, which a request with those values computes from its set.
      const reads = readNames(result);
      const key = keyOf(reads);
      const { file: targetFile, bodies: targetBodies } = documentOf(key);
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
        if (
          props.canChange?.(current) === false &&
          (options.markerProofs === undefined ||
            !readDependencyCache.canUseEmit(
              emitDir,
              current,
              result.emittedSources ?? {},
              props.canChange,
              options.markerProofs,
            ))
        )
          throw new Error("unsafe runtime publication outputs");
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
      if (props.canChange !== undefined)
        for (const [name, bytes] of files) {
          if (!systemTempOutsideProject.isProjectMarker(path.basename(name)))
            continue;
          const output = path.join(outputs, name);
          const marker = options.markerProofs?.[output];
          if (
            marker === undefined ||
            digest(bytes) !== marker.output ||
            !RuntimeProjectMarker.matches(
              output,
              result.emittedSources?.[output],
              marker,
            )
          )
            throw new Error("unproved runtime project marker");
        }
      if (props.canChange?.(directory) === false) return false;
      fs.mkdirSync(directory, { recursive: true });
      if (fs.lstatSync(directory).isSymbolicLink()) {
        report("not-recorded", "aliased-cache-directory", key);
        return false;
      }
      // The set is registered first and the record last, so a request that
      // finds the set finds the record once it exists. The outputs precede the
      // record, so a record is never visible before the bundle it names; a
      // reader that meets a newer bundle under an older record sees the
      // checksum differ and builds.
      register(reads);
      const staging = crypto.randomUUID();
      let temporary: string | undefined = path.join(
        directory,
        `${key}.${staging}.bundle.tmp`,
      );
      try {
        RuntimeEmitBundle.archive(temporary, files, hash);
        fs.renameSync(temporary, targetBodies);
        temporary = path.join(directory, `${key}.${staging}.tmp`);
        fs.writeFileSync(temporary, text, { flag: "wx" });
        fs.renameSync(temporary, targetFile);
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
    /**
     * Drive the publication of `result` to its end, reporting an IO failure as
     * refusal under the key it would be stored under.
     */
    const finish = (
      result: TtscBuildResult,
      steps: Generator<void | Promise<unknown>, boolean>,
    ): boolean => {
      try {
        for (;;) {
          const next = steps.next();
          if (next.done === true) return next.value;
        }
      } catch {
        report(
          "not-recorded",
          "cache-publication-io-or-output-failure",
          keyOf(readNames(result)),
        );
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
        /** Native receipt proof for an adopted launcher directory. */
        launcherAdoption?: ParkRequest["launcherAdoption"];
      },
      prior?: NonNullable<ParkRequest["replacement"]>["prior"],
      markerProofs?: RuntimeProjectMarker.Proofs,
    ): boolean => {
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
        parallel: markerProofs === undefined,
        markerProofs,
      });
      let settled = false;
      const pending: Publication = {
        step: () => {
          if (settled) return true;
          try {
            const next = steps.next();
            if (next.done === true) {
              if (
                next.value === true &&
                carried?.launcherAdoption !== undefined
              ) {
                try {
                  if (
                    props.canChange?.(carried.directory) === true &&
                    parkedIdentity(carried.directory) ===
                      carried.launcherAdoption.carriedIdentity
                  )
                    fs.writeFileSync(
                      path.join(carried.directory, PUBLISHED_FALLBACK),
                      "",
                      { flag: "wx" },
                    );
                } catch {
                  /* The receipt still preserves the build if marking fails. */
                }
              }
              return (settled = true);
            }
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
              keyOf(readNames(result)),
            );
            return (settled = true);
          }
        },
        request: () => {
          if (settled) return undefined;
          settled = true;
          if (markerProofs !== undefined) {
            // Complete the archive while the emit is still available. Raw
            // parking and cleanup keep their ordinary-directory guards.
            finish(result, steps);
            return undefined;
          }
          // Parked under the values of the variables it read and registered
          // now, so a request with other values neither finds nor discards it.
          const reads = readNames(result);
          const key = keyOf(reads);
          register(reads);
          report("parked", undefined, key);
          const parked = parkDestination(key);
          const sameVariant = prior?.filter(
            (candidate) =>
              path.dirname(candidate.directory) === path.dirname(parked),
          );
          const outputIdentity =
            sameVariant === undefined
              ? undefined
              : parkedIdentity(props.emitDir);
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
                replacement:
                  outputIdentity === undefined || sameVariant === undefined
                    ? undefined
                    : { outputIdentity, prior: sameVariant },
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
          if (
            request !== undefined &&
            !park(request, props.runDir, directory, props.canChange)
          )
            report(
              "not-recorded",
              "cache-publication-io-or-output-failure",
              keyOf(readNames(result)),
            );
        },
      };
      if (props.parkIn === undefined) {
        props.defer!(pending);
        return true;
      }
      if (markerProofs !== undefined) return finish(result, steps);
      try {
        const request = pending.request();
        if (
          request !== undefined &&
          saveParkRequest(props.parkIn, request, props.canChange)
        )
          return true;
      } catch {
        /* The caller can still serve its private output. */
      }
      report(
        "not-recorded",
        "cache-publication-io-or-output-failure",
        keyOf(readNames(result)),
      );
      return false;
    };
    /** Remove one parked build by a rename into the store's trash. */
    const discard = (parked: string): void => {
      if (
        fs.existsSync(parked) &&
        canMoveTree(parked, props.canChange) &&
        !RuntimeTrash.retire(parked, directory, props.canChange)
      )
        try {
          if (canMoveTree(parked, props.canChange))
            fs.rmSync(parked, { force: true, recursive: true });
        } catch {
          /* Collection owns what cannot be removed now. */
        }
    };
    /** The parked builds under `key`, newest first. */
    const parkedBuilds = (key: string): string[] => {
      const root = documentOf(key).parked;
      if (props.canChange?.(root) === false) return [];
      try {
        return fs
          .readdirSync(root)
          .sort()
          .reverse()
          .map((name) => path.join(root, name))
          .filter((parked) => props.canChange?.(parked) !== false);
      } catch {
        return [];
      }
    };
    // A parked build of this request is proven now, when it is needed. A
    // caller that runs the program takes its outputs by one rename, as a fresh
    // build would have left them, and stores or parks them again; another
    // caller publishes it. Both cost less than compiling again. A parked build
    // whose inputs have moved since is refused like any other and kept, as a
    // refused record is, since its inputs can return to what it was built
    // from; one older than a build this request adopted or built since goes.
    // Each candidate key holds the builds of other values apart, so a request
    // only meets the parked builds of its own values.
    let hasPublishedFallback = false;
    const tryParked = (fallbackOnly: boolean): TtscBuildResult | undefined => {
      if (props.recordParked === undefined) return undefined;
      let adopted: TtscBuildResult | undefined;
      let carried: Parameters<typeof defer>[4];
      let receiptRefused = false;
      for (const { key } of candidates) {
        if (adopted !== undefined || receiptRefused) break;
        let published = false;
        for (const parked of parkedBuilds(key)) {
          if (adopted !== undefined || published) {
            if (props.canChange === undefined) discard(parked);
            continue;
          }
          let publishedFallback = false;
          if (props.canChange !== undefined)
            try {
              publishedFallback =
                fs
                  .lstatSync(path.join(parked, PUBLISHED_FALLBACK), {
                    throwIfNoEntry: false,
                  })
                  ?.isFile() === true;
            } catch {
              continue;
            }
          if (publishedFallback) hasPublishedFallback = true;
          if (publishedFallback !== fallbackOnly) continue;
          const job = (() => {
            try {
              const jobFile = path.join(parked, "job.json");
              if (
                props.canChange !== undefined &&
                !fs.lstatSync(jobFile).isFile()
              )
                return undefined;
              return JSON.parse(fs.readFileSync(jobFile, "utf8"));
            } catch {
              return undefined;
            }
          })();
          if (
            job?.format !== PARKED_FORMAT ||
            job[proof.field] !== proof.value ||
            typeof job.emitDir !== "string" ||
            !path.isAbsolute(job.emitDir) ||
            job.result?.status !== 0
          ) {
            // Torn, or left by a format or request this one cannot prove. A
            // directory still being parked has no job yet; its parker reports
            // the failure, and only its own build is lost.
            if (props.canChange === undefined) discard(parked);
            continue;
          }
          try {
            const outputs = path.join(parked, "outputs");
            if (!canMoveTree(parked, props.canChange)) continue;
            if (props.defer === undefined && props.parkIn === undefined) {
              published = finish(
                job.result,
                publication(job.result, job.emitDir, outputs, (result) =>
                  lift(
                    job.recorded === true
                      ? result
                      : props.recordParked!(result, job.state),
                  ),
                ),
              );
              // Managed readers retain the parked output because the two
              // public files can be torn by another publisher.
              if (published && props.canChange === undefined) discard(parked);
              if (published && fallbackOnly) {
                const restored = lookup({ key });
                if (restored !== "missing" && restored !== undefined)
                  return restored;
              }
              continue;
            }
            const result: TtscBuildResult =
              job.recorded === true
                ? job.result
                : props.recordParked(job.result, job.state);
            const refused = proof.restores(result, job.emitDir);
            if (refused !== undefined) {
              report(
                "miss",
                "parked-input-proof-failed",
                key,
                undefined,
                undefined,
                refused,
              );
              continue;
            }
            // The run's output directory is empty until a build fills it. The
            // parked directory moves into the run whole, its outputs take the
            // output directory's place, and parking again moves both back
            // without rewriting the job, unless this adoption recorded the
            // observations it lacked. Each attempt owns a separate carried
            // path, so a lost claim cannot recover a later attempt's outputs.
            const moved = `${props.emitDir}.parked-${crypto.randomUUID()}`;
            const carry = {
              directory: moved,
              job:
                job.recorded === true
                  ? undefined
                  : { ...job, result, recorded: true, state: undefined },
            };
            const relocated = relocate(result, job.emitDir, props.emitDir);
            if (!fs.lstatSync(outputs).isDirectory()) continue;
            let launcherAdoption: ParkRequest["launcherAdoption"];
            if (launcherAdopts) {
              if (!isParkedAddress(directory, parked)) continue;
              const carriedIdentity = parkedIdentity(parked);
              const outputIdentity = parkedIdentity(outputs);
              if (
                carriedIdentity === undefined ||
                outputIdentity === undefined ||
                parkedJobKey(job) !== key
              )
                continue;
              launcherAdoption = { key, carriedIdentity, outputIdentity };
            }
            if (parkReceiptRun !== undefined) {
              // If this process is stopped after taking the directory, the
              // run owner must be able to return it even before outputs move.
              let saved = false;
              try {
                saved = saveParkRequest(
                  parkReceiptRun,
                  {
                    outputs: props.emitDir,
                    parked: parkDestination(key),
                    carried: moved,
                    job: carry.job,
                    launcherAdoption,
                  },
                  props.canChange,
                );
              } catch {
                /* An unreadable receipt directory must leave the build parked. */
              }
              if (!saved) {
                if (!requiresParkReceipt) continue;
                receiptRefused = true;
                break;
              }
            }
            if (
              props.canChange?.(moved) === false ||
              props.canChange?.(props.emitDir) === false ||
              (props.canChange !== undefined &&
                (fs.lstatSync(moved, { throwIfNoEntry: false }) !== undefined ||
                  !canMoveTree(parked, props.canChange))) ||
              (launcherAdoption !== undefined &&
                (parkedIdentity(parked) !== launcherAdoption.carriedIdentity ||
                  parkedIdentity(outputs) !== launcherAdoption.outputIdentity))
            )
              continue;
            fs.rmdirSync(props.emitDir);
            fs.renameSync(parked, moved);
            fs.renameSync(path.join(moved, "outputs"), props.emitDir);
            carried = { ...carry, launcherAdoption };
            adopted = relocated;
            report("reused", "parked", key);
            if (props.parkIn !== undefined) report("parked", undefined, key);
          } catch {
            /* Taken by a concurrent run, or unreadable: this run builds. */
            if (props.canChange?.(props.emitDir) !== false)
              fs.mkdirSync(props.emitDir, { recursive: true });
          }
        }
      }
      if (receiptRefused) return props.build();
      if (adopted !== undefined) {
        if (props.parkIn === undefined)
          defer(adopted, lift, undefined, true, carried);
        return adopted;
      }
      return undefined;
    };
    const freshParked = tryParked(false);
    if (freshParked !== undefined) return freshParked;
    // A fresh parked build may be newer than the record. An adopted launcher
    // build parked after publication is a backup for a torn record/bundle.
    let missing = true;
    for (const candidate of candidates) {
      const reused = lookup(candidate);
      if (reused === "missing") continue;
      missing = false;
      if (reused !== undefined) return reused;
    }
    if (hasPublishedFallback) {
      const fallback = tryParked(true);
      if (fallback !== undefined) return fallback;
    }
    if (missing) report("miss", "document-missing", key);
    const previousParked =
      props.canChange === undefined ||
      (props.defer === undefined && props.parkIn === undefined)
        ? undefined
        : candidates.flatMap(({ key: candidate }) =>
            parkedBuilds(candidate).flatMap((directory) => {
              const identity = parkedCandidateIdentity(directory);
              return identity === undefined ? [] : [{ directory, identity }];
            }),
          );
    const result = props.build();
    if (result.status !== 0) {
      report("not-recorded", "producer-failed", key);
      return result;
    }
    // Caller-owned stores retain their eager supersedence. A system store
    // keeps a durable fallback until a complete same-variant replacement is
    // parked. The independently published bundle and record are insufficient.
    const discardSuperseded = (): void => {
      for (const candidate of new Set([
        ...candidates.map((entry) => entry.key),
        keyOf(readNames(result)),
      ]))
        for (const parked of parkedBuilds(candidate)) discard(parked);
    };
    if (props.canChange === undefined) discardSuperseded();
    const record =
      props.recordSteps ??
      ((fresh: TtscBuildResult) => lift(props.record?.(fresh) ?? fresh));
    const markerProofs =
      props.canChange === undefined || result.emittedSources === undefined
        ? undefined
        : RuntimeProjectMarker.capture(props.emitDir, result.emittedSources);
    if (props.defer === undefined && props.parkIn === undefined) {
      finish(
        result,
        publication(result, props.emitDir, props.emitDir, record, {
          markerProofs,
        }),
      );
      return result;
    }
    // What parking needs is taken now, before a step consumes it.
    defer(
      result,
      record,
      props.parked?.(),
      false,
      undefined,
      previousParked,
      markerProofs,
    );
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
   * @evidence contracts/common.md#clear-and-simple-design The plan names the move and its job, with optional native identities for retiring earlier parked builds after a guarded replacement.
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
     * Fresh system replacement and the previously observed candidates it may
     * retire.
     */
    replacement?: {
      outputIdentity: string;
      prior: readonly { directory: string; identity: string }[];
    };

    /**
     * An adopted parked directory carried in the run, holding its job; it moves
     * back whole. Undefined for a fresh build.
     */
    carried?: string;

    /** Native ownership and exact variant of an interrupted launcher adoption. */
    launcherAdoption?: {
      key: string;
      carriedIdentity: string;
      outputIdentity: string;
    };

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
  const PARKS_DIRNAME = "parks";

  /** Persist a move before adoption can take output out of the store. */
  function saveParkRequest(
    runDir: string,
    request: ParkRequest,
    canChange?: (directory: string) => boolean,
  ): boolean {
    const parks = path.join(runDir, PARKS_DIRNAME);
    if (canChange?.(parks) === false) return false;
    fs.mkdirSync(parks, { recursive: true });
    // The owner reads requests only after this process stops. A torn write
    // leaves the store untouched because adoption requires this write first.
    fs.writeFileSync(
      path.join(parks, `${process.pid}-${crypto.randomUUID()}.json`),
      JSON.stringify(request),
      { flag: "wx" },
    );
    return true;
  }

  /**
   * Perform every park request the processes of a run left in it. The run's
   * owner calls this once no process of the run remains, before the run's
   * directory goes.
   *
   * @param runDir The run's directory.
   * @param store The run's qualified persistent build store.
   * @param canChange Current project and path ownership for a system cache.
   * @evidence contracts/common.md#principled-implementation A system request may move this run's dependency generation or recover a launcher fs carry whose native identities and environment variant match the saved adoption.
   * @evidence contracts/common.md#clear-and-simple-design One listing and one park per request.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A malformed request is skipped; its outputs go with the run.
   * @evidence contracts/common.md#meaningful-documentation The prose states when to call it.
   * @evidence contracts/portability.md#os-neutral-implementation Native readdir and read.
   * @evidence contracts/performance.md#efficient-algorithms One small JSON read and one park per request.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Parking is an effect.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained.
   */
  export function parkRequested(
    runDir: string,
    store?: string,
    canChange?: (directory: string) => boolean,
  ): void {
    const parks = path.join(runDir, PARKS_DIRNAME);
    if (canChange?.(parks) === false) return;
    let names: string[];
    try {
      names = fs.readdirSync(parks);
    } catch {
      return;
    }
    for (const name of names)
      try {
        const file = path.join(parks, name);
        if (canChange !== undefined && !fs.lstatSync(file).isFile()) continue;
        const request = JSON.parse(
          fs.readFileSync(file, "utf8"),
        ) as Partial<ParkRequest>;
        if (
          typeof request.outputs === "string" &&
          typeof request.parked === "string" &&
          path.isAbsolute(request.outputs) &&
          path.isAbsolute(request.parked)
        )
          park(request as ParkRequest, runDir, store, canChange, true);
      } catch {
        /* A torn request leaves its outputs to the run. */
      }
  }

  /**
   * Perform a park request. A fresh build moves its outputs beside its job. An
   * adopted build already carries a job and moves back to the store whole. A
   * failed move of a fresh build removes its partial parked directory.
   *
   * @param request A request from {@link Publication.request}.
   * @param runDir The build's owning run for a system cache.
   * @param store The build's selected persistent store.
   * @param canChange Current project and path ownership for a system cache.
   * @param recorded Whether the request came from a process's saved plan.
   * @returns Whether the build was parked.
   * @evidence contracts/common.md#principled-implementation Fresh parking writes the job before moving the outputs. Earlier system candidates may retire only once that exact replacement occupies the target and both jobs prove the same environment variant. Replay can confirm an already-committed move. Adoption recovery returns the carried directory whole.
   * @evidence contracts/common.md#clear-and-simple-design One function serves the launcher's own publication and requests left by its program's processes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed move reports false. Managed rollback only attempts removal of a still-qualified directory created by this call. A refused or failed rollback can leave the partial directory for collection.
   * @evidence contracts/common.md#meaningful-documentation The prose states the order and the failure effect.
   * @evidence contracts/portability.md#os-neutral-implementation Native mkdir, write and rename within the cache root's volume.
   * @evidence contracts/performance.md#efficient-algorithms The publication uses a job write and bounded moves. Guarded pruning visits only the captured candidates and scans their current owned trees before mutation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Parking is an effect.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The parked directory lives in the store until a request adopts or discards it, or collection removes it.
   */
  export function park(
    request: ParkRequest,
    runDir?: string,
    store?: string,
    canChange?: (directory: string) => boolean,
    recorded = false,
  ): boolean {
    let created = false;
    try {
      const replacement =
        request.carried === undefined ? request.replacement : undefined;
      if (
        canChange !== undefined &&
        store !== undefined &&
        replacement !== undefined &&
        runDir !== undefined &&
        canChange(runDir) &&
        ownsParkOutput(runDir, request.outputs, recorded) &&
        isFreshParkJob(request) &&
        parkedReplacementCommitted(request, store, canChange)
      ) {
        retirePreviousParked(store, replacement.prior, canChange, request);
        return true;
      }
      if (
        canChange !== undefined &&
        !canPark(request, runDir, store, canChange, recorded)
      )
        return false;
      if (request.carried !== undefined) {
        // The adopted directory goes back whole; its job is rewritten only
        // when the adoption recorded what the job lacked.
        const outputs = path.join(request.carried, "outputs");
        if (fs.lstatSync(outputs, { throwIfNoEntry: false }) === undefined)
          fs.renameSync(request.outputs, outputs);
        if (request.job !== undefined) {
          const job = path.join(request.carried, "job.json");
          const text = JSON.stringify(request.job);
          if (canChange === undefined) fs.writeFileSync(job, text);
          else {
            const temporary = path.join(
              request.carried,
              crypto.randomUUID() + ".job.tmp",
            );
            const fd = fs.openSync(temporary, "wx");
            try {
              try {
                fs.writeFileSync(fd, text);
              } finally {
                fs.closeSync(fd);
              }
              fs.renameSync(temporary, job);
            } finally {
              if (canChange(request.carried))
                fs.rmSync(temporary, { force: true });
            }
          }
        }
        fs.mkdirSync(path.dirname(request.parked), { recursive: true });
        fs.renameSync(request.carried, request.parked);
        return true;
      }
      if (canChange === undefined)
        fs.mkdirSync(request.parked, { recursive: true });
      else {
        fs.mkdirSync(path.dirname(request.parked), { recursive: true });
        fs.mkdirSync(request.parked);
      }
      created = true;
      fs.writeFileSync(
        path.join(request.parked, "job.json"),
        JSON.stringify(request.job),
      );
      fs.renameSync(request.outputs, path.join(request.parked, "outputs"));
      if (
        canChange !== undefined &&
        store !== undefined &&
        replacement !== undefined &&
        parkedIdentity(path.join(request.parked, "outputs")) ===
          replacement.outputIdentity
      )
        retirePreviousParked(store, replacement.prior, canChange, request);
      return true;
    } catch {
      if (
        request.carried !== undefined ||
        (canChange !== undefined &&
          (!created || !canMoveTree(request.parked, canChange)))
      )
        return false;
      try {
        fs.rmSync(request.parked, { force: true, recursive: true });
      } catch {
        /* Collection owns what cannot be removed now. */
      }
      return false;
    }
  }

  /** Capture the native directory identity without following a link. */
  function parkedIdentity(directory: string): string | undefined {
    try {
      const entry = fs.lstatSync(directory, {
        bigint: true,
        throwIfNoEntry: false,
      });
      if (entry?.isDirectory() && entry.ino !== 0n)
        return entry.dev + ":" + entry.ino;
    } catch {
      /* No current identity can authorize retirement. */
    }
    return undefined;
  }

  /** Observe only a parked directory whose job and outputs have both arrived. */
  function parkedCandidateIdentity(directory: string): string | undefined {
    try {
      if (!fs.lstatSync(path.join(directory, "job.json")).isFile())
        return undefined;
      const container = parkedIdentity(directory);
      const outputs = parkedIdentity(path.join(directory, "outputs"));
      return container === undefined || outputs === undefined
        ? undefined
        : container + "/" + outputs;
    } catch {
      return undefined;
    }
  }

  /** Qualify the exact two-level parked address inside this store. */
  function isParkedAddress(store: string, directory: string): boolean {
    const parent = path.dirname(directory);
    return (
      path.dirname(parent) === store &&
      /^[0-9a-f]{64}\.pending$/.test(path.basename(parent)) &&
      /^\d+-\d+-[0-9a-f-]{36}$/.test(path.basename(directory))
    );
  }

  /** Let a replay finish retirement only after the exact output was installed. */
  function parkedReplacementCommitted(
    request: ParkRequest,
    store: string,
    canChange: (directory: string) => boolean,
  ): boolean {
    if (
      !isParkedAddress(store, request.parked) ||
      !canMoveTree(request.parked, canChange)
    )
      return false;
    const job = path.join(request.parked, "job.json");
    const outputs = path.join(request.parked, "outputs");
    return (
      typeof request.replacement?.outputIdentity === "string" &&
      parkedIdentity(outputs) === request.replacement.outputIdentity &&
      fs.lstatSync(job, { throwIfNoEntry: false })?.isFile() === true &&
      fs.readFileSync(job, "utf8") === JSON.stringify(request.job)
    );
  }

  /** Retire only the observed instances that still occupy their store addresses. */
  function retirePreviousParked(
    store: string,
    prior: NonNullable<ParkRequest["replacement"]>["prior"],
    canChange: (directory: string) => boolean,
    replacement: ParkRequest,
  ): void {
    if (!Array.isArray(prior)) return;
    const pending = path.dirname(replacement.parked);
    const key = parkedJobKey(replacement.job);
    if (key === undefined || path.basename(pending) !== key + ".pending")
      return;
    for (const candidate of prior)
      try {
        if (
          typeof candidate?.directory !== "string" ||
          typeof candidate.identity !== "string" ||
          candidate.directory === replacement.parked ||
          path.dirname(candidate.directory) !== pending ||
          !isParkedAddress(store, candidate.directory) ||
          !canMoveTree(candidate.directory, canChange) ||
          parkedCandidateIdentity(candidate.directory) !== candidate.identity ||
          parkedJobKey(
            JSON.parse(
              fs.readFileSync(
                path.join(candidate.directory, "job.json"),
                "utf8",
              ),
            ),
          ) !== key
        )
          continue;
        if (
          !RuntimeTrash.retire(candidate.directory, store, canChange) &&
          canMoveTree(candidate.directory, canChange) &&
          parkedCandidateIdentity(candidate.directory) === candidate.identity
        )
          fs.rmSync(candidate.directory, { force: true, recursive: true });
      } catch {
        /* A replacement has committed; legacy candidates can survive cleanup. */
      }
  }

  /** Recover the exact variant from a producer job's recorded inputs. */
  function parkedJobKey(value: unknown): string | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const job = value as Partial<{
      format: string;
      identity: string;
      snapshot: string;
      result: TtscBuildResult;
    }>;
    if (job.format !== PARKED_FORMAT || job.result?.status !== 0)
      return undefined;
    const proof =
      typeof job.identity === "string"
        ? "replay\0" + job.identity
        : job.snapshot;
    if (typeof proof !== "string") return undefined;
    const inputs = job.result.environmentInputs;
    if (
      inputs !== undefined &&
      (typeof inputs !== "object" || inputs === null || Array.isArray(inputs))
    )
      return undefined;
    const entries: [string, string | null][] = [];
    for (const name of Object.keys(inputs ?? {}).sort()) {
      const part = inputs?.[name];
      if (typeof part !== "string" && part !== null) return undefined;
      entries.push([name, part]);
    }
    return environmentKey(digest(FORMAT + "\0" + proof), entries);
  }

  /** Bind one build identity to its ordered observations of the environment. */
  function environmentKey(
    identity: string,
    entries: readonly (readonly [string, string | null])[],
  ): string {
    return entries.length === 0
      ? identity
      : digest(identity + "\0" + JSON.stringify(entries));
  }

  /** Check a complete move tree without following linked directories. */
  function canMoveTree(
    directory: string,
    canChange?: (directory: string) => boolean,
  ): boolean {
    if (canChange === undefined) return true;
    if (!canChange(directory)) return false;
    try {
      const children =
        process.platform === "win32"
          ? fs.readdirSync(directory, { withFileTypes: true })
          : readPosixDirectoryEntries(directory);
      return children.every((child) => {
        const name = child.name.toString();
        return (
          (!Buffer.isBuffer(child.name) ||
            Buffer.from(name).equals(child.name)) &&
          !child.isSymbolicLink() &&
          (!child.isDirectory() ||
            canMoveTree(path.join(directory, name), canChange))
        );
      });
    } catch {
      return false;
    }
  }

  /** Qualify the recorded build plan against its original run and store. */
  function canPark(
    request: ParkRequest,
    runDir: string | undefined,
    store: string | undefined,
    canChange: (directory: string) => boolean,
    recorded: boolean,
  ): boolean {
    if (
      runDir === undefined ||
      store === undefined ||
      !canChange(runDir) ||
      !canChange(request.parked)
    )
      return false;
    const launcherAdoption = recorded ? request.launcherAdoption : undefined;
    if (
      !ownsParkOutput(
        runDir,
        request.outputs,
        recorded && launcherAdoption === undefined,
      ) ||
      (launcherAdoption !== undefined &&
        (request.carried === undefined ||
          !path.relative(runDir, request.outputs).startsWith("fs" + path.sep)))
    )
      return false;
    if (
      !isParkedAddress(store, request.parked) ||
      fs.lstatSync(request.parked, { throwIfNoEntry: false }) !== undefined
    )
      return false;
    if (request.carried !== undefined) {
      const prefix = request.outputs + ".parked-";
      if (
        typeof request.carried !== "string" ||
        !request.carried.startsWith(prefix) ||
        !/^[0-9a-f-]{36}$/.test(request.carried.slice(prefix.length)) ||
        !canMoveTree(request.carried, canChange)
      )
        return false;
      const jobFile = path.join(request.carried, "job.json");
      if (!fs.lstatSync(jobFile).isFile()) return false;
      const previous = JSON.parse(fs.readFileSync(jobFile, "utf8"));
      if (
        previous?.format !== PARKED_FORMAT ||
        (request.job !== undefined &&
          (typeof request.job !== "object" ||
            request.job === null ||
            !("emitDir" in request.job) ||
            request.job.emitDir !== previous.emitDir))
      )
        return false;
      const carriedOutput = path.join(request.carried, "outputs");
      const outputsInCarry =
        fs
          .lstatSync(carriedOutput, {
            throwIfNoEntry: false,
          })
          ?.isDirectory() === true;
      if (
        launcherAdoption !== undefined &&
        (typeof launcherAdoption?.key !== "string" ||
          typeof launcherAdoption.carriedIdentity !== "string" ||
          typeof launcherAdoption.outputIdentity !== "string" ||
          path.basename(path.dirname(request.parked)) !==
            launcherAdoption.key + ".pending" ||
          parkedJobKey(previous) !== launcherAdoption.key ||
          (request.job !== undefined &&
            parkedJobKey(request.job) !== launcherAdoption.key) ||
          parkedIdentity(request.carried) !==
            launcherAdoption.carriedIdentity ||
          parkedIdentity(outputsInCarry ? carriedOutput : request.outputs) !==
            launcherAdoption.outputIdentity)
      )
        return false;
      if (outputsInCarry) return true;
    } else if (!isFreshParkJob(request)) return false;
    return canMoveTree(request.outputs, canChange);
  }

  /** Match a fresh plan to the output named by its producer job. */
  function isFreshParkJob(request: ParkRequest): boolean {
    return (
      typeof request.job === "object" &&
      request.job !== null &&
      "format" in request.job &&
      request.job.format === PARKED_FORMAT &&
      "emitDir" in request.job &&
      request.job.emitDir === request.outputs
    );
  }

  /** Validate the original run-relative source spelling for parking or replay. */
  function ownsParkOutput(
    runDir: string,
    output: string,
    recorded: boolean,
  ): boolean {
    const relative = path.relative(runDir, output);
    if (path.join(runDir, relative) !== output) return false;
    const [area, key, generation, ...extra] = relative.split(path.sep);
    return (
      (!recorded && area === "fs") ||
      (area === "deps" &&
        /^[0-9a-f]{16}$/.test(key ?? "") &&
        /^gen-[0-9a-f]{32}$/.test(generation ?? "") &&
        extra.length === 0)
    );
  }

  const PARKED_FORMAT = "ttsx-runtime-parked-v1";

  /** An adopted launcher build kept as fallback after record publication. */
  const PUBLISHED_FALLBACK = "publication-completed";

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
  function digest(text: string | Buffer): string {
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

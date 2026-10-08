import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Own the compiler archives produced for one ordinary E2E invocation.
 *
 * Each fresh owner runs the normal producer and publishes its exact immutable
 * generation. Borrowing transfers those bytes, without predicting a later pack
 * of the source tree. Borrowers keep the allocation alive until they return.
 * Unknown readers and failed release remain sticky.
 */
export namespace CompilerArchives {
  /** A detached archive proof delivered to the actual preparation child. */
  export interface Artifact {
    /** Actual package manifest name used by installed dependencies. */
    name: string;

    /** Repository-relative package selection owned by the real toolchain. */
    directory: string;

    /** Run-owned archive spelling delivered to pnpm's real installation. */
    archive: string;

    /** Native target spelling captured from that produced regular file. */
    physical: string;

    /** Native file/version signature; content digest remains a separate proof. */
    identity: string;

    /** SHA-256 of the producer's exact compressed bytes, not a second pack. */
    sha256: string;
  }

  /** One consumer's claim on existing archives; it grants no removal authority. */
  export interface Borrow {
    readonly artifacts: readonly Artifact[];

    /** Recheck the allocation and exact borrowed archive files. */
    assertAvailable(): void;

    /** Permanently block reuse when this reader's closure is unknown. */
    retain(reason: string): void;

    /** Return only after the actual archive reader has completed. */
    release(): void;
  }

  /** The allocation owner alone closes archives after every borrower returns. */
  export interface Owner {
    /** Qualify the produced generation before granting one read lifetime. */
    borrow(): Borrow;

    /** Caller-owned removal runs only with no active or unknown borrowers. */
    close(release: () => void): void;
  }

  /**
   * Run the supplied normal pack producer once for each selected package.
   *
   * The normal producer observes its actual source, configuration and toolchain
   * inputs. A fresh owner cannot adopt an existing destination. Once published,
   * its archive bytes define this generation; changed source inputs require a
   * new producer when another generation is requested. The caller owns failed
   * or partially produced allocations. An explicit containing allocation pins
   * the caller's removal root as well as the archive output directory; it does
   * not grant removal authority over a root the caller does not own.
   *
   * @evidence contracts/common.md#principled-implementation Each fresh owner runs the normal pack producers and owns their exact immutable archive generation. Borrowers consume that explicit generation, as the existing materializer contract permits, rather than asking for a cached result of packing a possibly changed source tree.
   * @evidence contracts/common.md#clear-and-simple-design The owner grants read lifetimes and alone admits the caller's allocation-removal callback. Output and optional containing allocation are pinned together, keeping archive placement separate from the root that cleanup removes. Detached archive proofs cross the preparation process boundary; one private streaming reader qualifies their physical identity and bytes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Real producers remain explicit operations. Content hashes accompany native file identity; matching names, versions, timestamps or a historical invocation never authorize reuse.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies one invocation, the interfaces distinguish borrowing from removal authority, and member comments explain sticky retention and required return boundaries. Refusal records the already observed expected/current path, native signature and digest so a changed generation is distinguishable from a metadata-only mismatch.
   * @evidence contracts/portability.md#os-neutral-implementation Node's native realpath and bigint descriptor metadata observe actual allocations and regular files without OS case assumptions. Selected package roots must be native directories within the repository; linked or nonregular archives refuse qualification.
   * @evidence contracts/performance.md#efficient-algorithms The owner reads selected package manifests once and streams each produced archive with a fixed 64 KiB buffer at publication and reader boundaries. At most two directory allocations require native metadata observations; coincident physical roots share one stat observation. Work follows archive bytes and consumers, without whole-source scans, configuration subprocesses or a second packlist implementation; no wall-time speedup is assumed.
   * @evidence contracts/performance.md#reuse-equivalent-work The finite run shares one producer's exact immutable bytes with independent installations. Every new owner runs fresh normal production, even when names and versions match. Borrowing validates this published generation and its allocation, not equivalence to a new pack of today's source; changed or replaced archive bytes refuse reuse.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Retained proofs grow with selected packages, not historical runs; streams close synchronously and only fixed-size buffers hold file bytes. Active loans block owner removal, unknown readers and failed removal remain sticky, and actual allocation cleanup stays with the caller.
   */
  export function create(props: {
    repository: string;
    output: string;

    /** Caller-owned cleanup root containing output; defaults to output itself. */
    allocation?: string;

    directories: readonly string[];
    produce: (directory: string, archive: string) => void;
    retain: (reason: string) => void;
    observe?: (event: {
      phase: string;
      elapsedMs: number;
      files?: number;
      bytes?: number;
      directory?: string;
    }) => void;
  }): Owner {
    const repository = fs.realpathSync.native(props.repository);
    const output = fs.realpathSync.native(props.output);
    const allocations = [
      {
        physical: output,
        spellings: [props.output],
        identity: fs.statSync(output, { bigint: true }),
      },
    ];
    if (props.allocation !== undefined && props.allocation !== props.output) {
      const allocation = fs.realpathSync.native(props.allocation);
      if (allocation !== output && !inside(allocation, output))
        throw new Error("Compiler archive output must be inside its allocation");
      if (allocation === output)
        allocations[0]!.spellings.push(props.allocation);
      else
        allocations.push({
          physical: allocation,
          spellings: [props.allocation],
          identity: fs.statSync(allocation, { bigint: true }),
        });
    }
    if (allocations.some((allocation) => !allocation.identity.isDirectory()))
      throw new Error("Compiler archive allocation must be a directory");
    const assertOutput = (): void => {
      for (const allocation of allocations) {
        const current = fs.statSync(allocation.physical, { bigint: true });
        if (
          !current.isDirectory() ||
          allocation.spellings.some(
            (spelling) =>
              fs.realpathSync.native(spelling) !== allocation.physical,
          ) ||
          current.dev !== allocation.identity.dev ||
          current.ino !== allocation.identity.ino
        )
          throw new Error("Compiler archive allocation was replaced");
      }
    };
    const selected = props.directories.map((directory) => {
      const root = path.resolve(repository, directory);
      if (!inside(repository, root) || fs.realpathSync.native(root) !== root)
        throw new Error(
          "Compiler archive source must be inside its repository",
        );
      return { directory, root };
    });
    const artifacts = Object.freeze(
      selected.map(({ directory, root }) => {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(root, "package.json"), "utf8"),
        );
        if (typeof manifest.name !== "string" || !manifest.name)
          throw new Error("Compiler archive package must have a name");
        const archive = path.join(output, path.basename(directory) + ".tgz");
        if (fs.lstatSync(archive, { throwIfNoEntry: false }))
          throw new Error(
            "Compiler archive producer refuses an existing destination",
          );
        const started = performance.now();
        props.produce(directory, archive);
        props.observe?.({
          phase: "pack",
          directory,
          elapsedMs: performance.now() - started,
        });
        assertOutput();
        const proofStarted = performance.now();
        const cost = { files: 0, bytes: 0 };
        const proof = readFile(archive, cost);
        props.observe?.({
          phase: "qualify-archive",
          directory,
          elapsedMs: performance.now() - proofStarted,
          ...cost,
        });
        return Object.freeze({
          name: manifest.name,
          directory,
          archive,
          ...proof,
        });
      }),
    );
    let reason: string | undefined;
    let closed = false;
    let borrowers = 0;
    const retain = (message: string): void => {
      if (reason !== undefined) return;
      reason = message;
      props.retain(message);
    };
    const assertAvailable = (): void => {
      if (reason !== undefined)
        throw new Error("Compiler archives retained: " + reason);
      if (closed) throw new Error("Compiler archive owner is closed");
      assertOutput();
      const started = performance.now();
      const cost = { files: 0, bytes: 0 };
      for (const artifact of artifacts) {
        const current = readFile(artifact.archive, cost);
        if (
          current.physical !== artifact.physical ||
          current.identity !== artifact.identity ||
          current.sha256 !== artifact.sha256
        ) {
          const details = {
            expected: {
              physical: artifact.physical,
              identity: artifact.identity,
              sha256: artifact.sha256,
            },
            current,
            changed: {
              physical: current.physical !== artifact.physical,
              identity: current.identity !== artifact.identity,
              sha256: current.sha256 !== artifact.sha256,
            },
          };
          throw new Error(
            "Compiler archive changed before reuse: " +
              artifact.name +
              "; " +
              JSON.stringify(details),
            { cause: details },
          );
        }
      }
      props.observe?.({
        phase: "qualify-archives",
        elapsedMs: performance.now() - started,
        ...cost,
      });
    };
    return {
      borrow() {
        assertAvailable();
        borrowers++;
        let released = false;
        return {
          artifacts,
          assertAvailable() {
            if (released)
              throw new Error("Compiler archive borrow is released");
            assertAvailable();
          },
          retain(message) {
            if (released)
              throw new Error("Compiler archive borrow is released");
            retain(message);
          },
          release() {
            if (released)
              throw new Error("Compiler archive borrow is released");
            if (reason !== undefined)
              throw new Error("Compiler archives retained: " + reason);
            released = true;
            borrowers--;
          },
        };
      },
      close(release) {
        if (closed) return;
        if (reason !== undefined)
          throw new Error("Compiler archives retained: " + reason);
        if (borrowers !== 0)
          throw new Error("Compiler archive borrowers have not returned");
        try {
          assertOutput();
          release();
          closed = true;
        } catch (error) {
          try {
            retain("Compiler archive release failed");
          } catch (retention) {
            throw new AggregateError(
              [error, retention],
              "Compiler archive release and retention failed",
            );
          }
          throw error;
        }
      },
    };
  }
}

function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative !== "" &&
    !path.isAbsolute(relative) &&
    relative !== ".." &&
    !relative.startsWith(".." + path.sep)
  );
}

function identity(value: fs.BigIntStats): string {
  return [
    value.dev,
    value.ino,
    value.size,
    value.mode,
    value.mtimeNs,
    value.ctimeNs,
  ].join(":");
}

function readFile(
  file: string,
  cost: { files: number; bytes: number },
): {
  physical: string;
  identity: string;
  sha256: string;
} {
  if (!fs.lstatSync(file).isFile())
    throw new Error("Compiler archive input must be a regular file: " + file);
  const physical = fs.realpathSync.native(file);
  const descriptor = fs.openSync(file, "r");
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    const hash = crypto.createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let size = 0;
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      size += count;
      cost.bytes += count;
      hash.update(buffer.subarray(0, count));
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    if (
      identity(before) !== identity(after) ||
      BigInt(size) !== before.size ||
      fs.realpathSync.native(file) !== physical ||
      identity(fs.statSync(file, { bigint: true })) !== identity(before)
    )
      throw new Error("Compiler archive input changed while reading: " + file);
    cost.files++;
    return { physical, identity: identity(before), sha256: hash.digest("hex") };
  } finally {
    fs.closeSync(descriptor);
  }
}

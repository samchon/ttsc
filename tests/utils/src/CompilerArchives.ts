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
 *
 * @evidence contracts/common.md#principled-implementation One fresh producer generation binds exact compressed archive bytes and native allocation identity; explicit loans separate qualified reading from owner-only removal.
 * @evidence contracts/common.md#clear-and-simple-design The namespace groups detached proofs, reader and owner handles with one create operation; private helpers implement containment and streaming qualification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No historical name/version lookup adopts archives, no source-equivalence guess replaces normal production, and active or unknown readers forbid cleanup.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain immutable-generation transfer, while types and method comments distinguish package/file identity, borrowing, sticky retention and removal authority.
 * @evidence contracts/portability.md#os-neutral-implementation Node native realpath, bigint file metadata and regular-file checks establish actual allocation and archive identity without OS-name or path-case inference.
 * @evidence contracts/performance.md#efficient-algorithms Selected manifests are read once and archive bytes stream through a fixed-size buffer at publication and reader boundaries; allocation checks are bounded by two roots.
 * @evidence contracts/performance.md#reuse-equivalent-work The finite owner shares one normal producer generation with compatible readers; each new owner produces afresh and every admitted reader requalifies those exact bytes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Retained proofs grow with selected packages, outstanding loans block removal, unknown readers and failed release remain sticky, and caller-owned cleanup follows actual completion.
 */
export namespace CompilerArchives {
  /**
   * A detached archive proof delivered to the actual preparation child.
   *
   * @evidence contracts/common.md#principled-implementation The fields bind one actual selected package and its produced archive to native physical identity and an independent content digest; they do not describe a new pack of the current source tree.
   * @evidence contracts/common.md#clear-and-simple-design One detached record crosses the preparation-child boundary without carrying the parent owner or granting cleanup authority.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Package names and archive spellings accompany native identity and exact bytes; the record alone does not authorize reuse.
   * @evidence contracts/common.md#meaningful-documentation Member comments distinguish selected package, delivered path, physical target, native version signature and compressed-byte digest.
   * @evidence contracts/portability.md#os-neutral-implementation Native physical paths and file-version signatures remain separate from content identity and repository-relative package selection.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Artifact describes the handle contract; processing, reuse admission and resource lifetime decisions belong to its implementing operations.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Artifact describes the handle contract; processing, reuse admission and resource lifetime decisions belong to its implementing operations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Artifact describes the handle contract; processing, reuse admission and resource lifetime decisions belong to its implementing operations.
   */
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

  /**
   * One consumer's claim on existing archives; it grants no removal authority.
   *
   * @evidence contracts/common.md#principled-implementation The handle identifies one reader of an already produced immutable generation and requires explicit validation and return around its actual read lifetime.
   * @evidence contracts/common.md#clear-and-simple-design Availability, sticky retention and return are separate operations; removal authority stays with the owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A loan transfers existing bytes rather than predicting a pack result or allowing a reader to delete its producer allocation.
   * @evidence contracts/common.md#meaningful-documentation The headline and method comments identify the reader lifetime, requalification boundary, unknown-closure retention and required completion before return.
   * @evidence contracts/portability.md#os-neutral-implementation The loan carries archive proofs whose native path and file identity are requalified by the implementation on each actual filesystem.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Borrow describes the handle contract; processing, reuse admission and resource lifetime decisions belong to its implementing operations.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Borrow describes the handle contract; processing, reuse admission and resource lifetime decisions belong to its implementing operations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Borrow describes the handle contract; processing, reuse admission and resource lifetime decisions belong to its implementing operations.
   */
  export interface Borrow {
    /** Immutable archive proofs read within this loan's qualified lifetime. */
    readonly artifacts: readonly Artifact[];

    /**
     * Recheck the allocation and exact borrowed archive files.
     *
     * @evidence contracts/common.md#principled-implementation The concrete loan rejects a returned handle and delegates retained/closed allocation and native identity/content checks to its owner before allowing another read.
     * @evidence contracts/common.md#clear-and-simple-design This check validates the existing loan without producing another archive, returning the loan or granting removal authority.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Names and timestamps alone cannot authorize reading; the owner still compares the actual generation identity and SHA-256.
     * @evidence contracts/common.md#meaningful-documentation The headline identifies the requalification boundary for a reader that still owns this loan.
     * @evidence contracts/portability.md#os-neutral-implementation The concrete owner qualifies actual native allocation paths and file metadata; the signature introduces no OS-specific spelling or guessed capability.
     * @evidence contracts/performance.md#efficient-algorithms The concrete operation checks at most two allocation roots and streams each archive once with a fixed buffer; work follows selected compressed bytes.
     * @evidence contracts/performance.md#reuse-equivalent-work Revalidation concerns the already produced immutable generation, not a cached result of repacking current source inputs.
     * @evidence contracts/performance.md#bound-retention-and-release-resources Validation opens and closes its own file descriptors while the existing loan remains active until its caller explicitly returns it.
     */
    assertAvailable(): void;

    /**
     * Permanently block reuse when this reader's closure is unknown.
     *
     * @evidence contracts/common.md#principled-implementation The concrete loan requires an active handle and records the first retention reason before notifying its owner callback, so callback failure cannot restore availability.
     * @evidence contracts/common.md#clear-and-simple-design Retention records uncertain reader closure separately from normal return and allocation removal.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Uncertain completion never becomes a synthetic release, retry or permission to remove producer inputs.
     * @evidence contracts/common.md#meaningful-documentation The headline states why unknown reader closure permanently blocks reuse within this owner.
     * @evidence contracts/portability.md#os-neutral-implementation Reason text carries no native path representation; any allocation retention effect belongs to the supplied owner callback.
     * @evidence contracts/performance.md#efficient-algorithms The first reason updates fixed owner state and invokes the callback once; later reasons do not repeat that notification.
     * @evidence contracts/performance.md#reuse-equivalent-work Sticky retention forbids further borrowing even if the archive bytes still match, because reader lifetime is no longer qualified.
     * @evidence contracts/performance.md#bound-retention-and-release-resources Unknown readers keep the original allocation retained; the operation neither closes their handles nor claims their completion.
     */
    retain(reason: string): void;

    /**
     * Return only after the actual archive reader has completed.
     *
     * @evidence contracts/common.md#principled-implementation The concrete handle rejects repeated or retained returns and otherwise marks this loan released before decrementing its owner borrower count.
     * @evidence contracts/common.md#clear-and-simple-design Return ends this reader lifetime without removing files or closing the producer owner.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller must establish actual reader completion; the handle does not infer it from elapsed time or synthesize a child result.
     * @evidence contracts/common.md#meaningful-documentation The headline names the completion prerequisite for returning this loan.
     * @evidence contracts/portability.md#os-neutral-implementation Returning updates process-local ownership state without changing native paths or applying an OS-specific cleanup assumption.
     * @evidence contracts/performance.md#efficient-algorithms A released flag and borrower count provide constant state work without rescanning archive contents.
     * @evidence contracts/performance.md#reuse-equivalent-work Return permits later owner decisions but never certifies changed source inputs or another archive generation.
     * @evidence contracts/performance.md#bound-retention-and-release-resources Exactly one valid return ends this handle lifetime; retained or repeated returns fail without withdrawing unknown reader protection.
     */
    release(): void;
  }

  /**
   * The allocation owner alone closes archives after every borrower returns.
   *
   * @evidence contracts/common.md#principled-implementation The interface separates granting qualified reads from closing the caller-owned allocation after those readers return.
   * @evidence contracts/common.md#clear-and-simple-design Two operations expose read admission and owner-only release without exposing mutable borrower counts or native proofs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Ownership does not permit adopting an existing archive or removing inputs while readers remain active or unknown.
   * @evidence contracts/common.md#meaningful-documentation The headline and method comments distinguish produced-generation qualification from caller-owned removal authority.
   * @evidence contracts/portability.md#os-neutral-implementation The implementation qualifies actual native allocation and archive identity; this interface introduces no OS-name or path-case assumptions.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Owner describes the handle contract; processing, reuse admission and resource lifetime decisions belong to its implementing operations.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Owner describes the handle contract; processing, reuse admission and resource lifetime decisions belong to its implementing operations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Owner describes the handle contract; processing, reuse admission and resource lifetime decisions belong to its implementing operations.
   */
  export interface Owner {
    /**
     * Qualify the produced generation before granting one read lifetime.
     *
     * @evidence contracts/common.md#principled-implementation The concrete owner validates its allocation and immutable archive proofs before incrementing its borrower count and returning a fresh active handle.
     * @evidence contracts/common.md#clear-and-simple-design Read admission and owner removal remain separate operations; each handle exposes only validation, retention and return.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Borrowing cannot adopt an existing destination or grant a loan to retained, closed, corrupted or replaced producer state.
     * @evidence contracts/common.md#meaningful-documentation The headline identifies validation before the reader lifetime begins.
     * @evidence contracts/portability.md#os-neutral-implementation Admission compares actual native directory/file identity and archive bytes without assuming path case or platform capability from an OS name.
     * @evidence contracts/performance.md#efficient-algorithms Admission checks fixed allocation state and streams the selected archive bytes, then allocates one small handle with no whole-source scan.
     * @evidence contracts/performance.md#reuse-equivalent-work Independent consumers borrow the same explicitly produced generation while every new admission requalifies its exact immutable bytes.
     * @evidence contracts/performance.md#bound-retention-and-release-resources One admitted handle increments outstanding readers; allocation removal remains blocked until every actual reader returns and none is retained.
     */
    borrow(): Borrow;

    /**
     * Caller-owned removal runs only with no active or unknown borrowers.
     *
     * @evidence contracts/common.md#principled-implementation The concrete owner refuses retained or active-reader state, rechecks allocation identity and marks itself closed only after the caller removal callback returns successfully.
     * @evidence contracts/common.md#clear-and-simple-design The callback owns actual removal; this operation owns admission, idempotent completion and sticky retention after failure.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts A substituted allocation cannot grant deletion authority, and failed removal is not retried or reported as successful cleanup.
     * @evidence contracts/common.md#meaningful-documentation The headline separates caller removal from the no-active-or-unknown-reader prerequisite.
     * @evidence contracts/portability.md#os-neutral-implementation Native allocation identity is revalidated before delegating removal; the callback retains responsibility for its actual filesystem operation.
     * @evidence contracts/performance.md#efficient-algorithms Reader-state guards and bounded allocation observations precede the callback; removal cost belongs to the caller allocation rather than an extra archive scan.
     * @evidence contracts/performance.md#reuse-equivalent-work A successfully closed owner ignores repeated close calls; retained failure blocks reuse instead of granting another producer generation.
     * @evidence contracts/performance.md#bound-retention-and-release-resources Only returned readers permit removal. Callback or allocation failure keeps retention sticky, preserving the original error and any retention failure.
     */
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
    /** Repository containing the actual selected package manifests. */
    repository: string;

    /** Existing caller-owned directory reserved for this archive generation. */
    output: string;

    /** Caller-owned cleanup root containing output; defaults to output itself. */
    allocation?: string;

    /** Repository-relative packages whose normal producers run once each. */
    directories: readonly string[];

    /** Normal package producer writing the exclusively selected destination. */
    produce: (directory: string, archive: string) => void;

    /** Caller notification when unknown readers or failed removal retain inputs. */
    retain: (reason: string) => void;

    /** Optional observations of actual production and archive qualification. */
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

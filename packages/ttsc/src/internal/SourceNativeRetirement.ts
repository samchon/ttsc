import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { OwnedSynchronousProcess } from "./OwnedSynchronousProcess";

/**
 * Preserve source-build resources until their native boundary has retired.
 *
 * Guards are published before command admission. Pending and uncertified
 * boundaries protect inputs from cooperating collectors even after their Node
 * owner disappears. Neither PID absence nor elapsed time grants reclamation.
 * Older compiler versions do not implement these guards and cannot safely
 * share quarantined roots. External deletion is outside this protocol.
 *
 * @evidence contracts/common.md#principled-implementation Exact pre-admission guards protect inputs until the original native boundary certifies closure; PID absence and age never grant authority.
 * @evidence contracts/common.md#clear-and-simple-design One protocol owns admission, deferred cleanup and collector checks; native containment remains with the command owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Durable pending records remain conservative when unknown diagnostics cannot be published.
 * @evidence contracts/common.md#meaningful-documentation Native prose states cooperative-version limits and the absence of disk-only recovery authority.
 * @evidence contracts/portability.md#os-neutral-implementation Node realpath, lstat and argv-independent JSON paths represent actual filesystem roots; later namespace replacement remains outside the retained-handle premise.
 * @evidence contracts/performance.md#efficient-algorithms Member operations own scans and publication costs; the namespace itself executes no algorithm.
 * @evidence contracts/performance.md#reuse-equivalent-work Guards carry ownership, not reusable compiler results.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Unknown boundaries intentionally retain inputs without an age bound; losing the original closure capability requires operator-confirmed external closure.
 */
export namespace SourceNativeRetirement {
  /**
   * Original task capability retained for qualified recovery. Losing this
   * object leaves durable guards and requires external closure confirmation;
   * loading guard bytes does not manufacture native reclamation authority.
   *
   * @evidence contracts/common.md#principled-implementation Original task identity, resources, admitted boundaries and cleanup callbacks express separate ownership states.
   * @evidence contracts/common.md#clear-and-simple-design Maps index roots and boundary tokens while the FIFO preserves normal finally order.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Disk metadata cannot construct this original task capability or certify process closure.
   * @evidence contracts/common.md#meaningful-documentation Field prose explains original authority and the consequence of losing it.
   * @evidence contracts/portability.md#os-neutral-implementation Resources contain observed physical native roots; command retirement authority is an in-memory capability.
   * @evidence contracts/performance.md#efficient-algorithms This type declares state without executing an algorithm.
   * @evidence contracts/performance.md#reuse-equivalent-work Task identity permits no equivalent-result sharing.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The type acquires no resources itself; begin, settle and recover own their lifetimes.
   */
  export interface Scope {
    /** Identity supplied by the original worker request owner. */
    taskToken: string;

    /** Currently registered physical roots and their retained input paths. */
    resources: Map<string, Resource>;

    /** Original native admission capabilities, never reconstructed from disk. */
    boundaries: Map<string, Boundary>;

    /** Original cleanup callbacks, in normal finally-unwinding order. */
    deferred: Array<() => void>;

    /**
     * Optional task-local publication primitives for an explicit filesystem
     * boundary oracle. Omitted tasks use Node's original synchronous APIs.
     * Implementations must preserve exclusive-open and real descriptor meaning.
     */
    guardFileOperations?: Pick<typeof fs, "openSync" | "writeFileSync" | "closeSync" | "renameSync" | "rmSync">;
  }

  /** Allocate an empty task capability without acquiring a filesystem guard.
   *
   * @evidence contracts/common.md#principled-implementation A nonempty task token distinguishes the original admission owner and starts with no native commands.
   * @evidence contracts/common.md#clear-and-simple-design Two maps and one FIFO separate registration, boundary state and deferred cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Allocation grants no native closure certificate from PID or elapsed time.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies allocation without filesystem acquisition.
   * @evidence contracts/portability.md#os-neutral-implementation Allocation handles opaque identity and collections without native operations.
   * @evidence contracts/performance.md#efficient-algorithms One object and three empty collections take constant initial space.
   * @evidence contracts/performance.md#reuse-equivalent-work Each task receives distinct mutable ownership state rather than a shared result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the returned capability; no filesystem or process handle is acquired.
   */
  export function createScope(taskToken: string): Scope {
    if (taskToken.length === 0) throw new Error("ttsc: empty native task identity");
    return { taskToken, resources: new Map(), boundaries: new Map(), deferred: [] };
  }

  /** Install one synchronous task; promises do not extend its lexical lifetime.
   *
   * @evidence contracts/common.md#principled-implementation Finally restores the predecessor even when task work throws.
   * @evidence contracts/common.md#clear-and-simple-design One lexical saved reference supports nested synchronous scopes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An asynchronously returned value cannot extend this synchronous authority implicitly.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the synchronous lifetime and promise limitation.
   * @evidence contracts/portability.md#os-neutral-implementation Scope sequencing has no native path or process representation.
   * @evidence contracts/performance.md#efficient-algorithms One reference save and restore surround delegated callback cost.
   * @evidence contracts/performance.md#reuse-equivalent-work Every effectful callback runs independently; this operation caches no answer.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Restoration releases the global reference while the original caller retains its task capability.
   */
  export function run<T>(scope: Scope, task: () => T): T {
    const previous = current;
    current = scope;
    try { return task(); }
    finally { current = previous; }
  }

  /**
   * Register inputs before their first native command. Additional paths merge
   * with the same held generation; conflicting generation authority is refused.
   * Ordinary synchronous callers acquire no new protocol state.
   *
   * @evidence contracts/common.md#principled-implementation Physical root identity and generation/nonce consistency bind additional paths to the same held resource.
   * @evidence contracts/common.md#clear-and-simple-design A root-indexed map merges paths while retaining one generation capability.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Registration is opt-in and cannot silently substitute a conflicting generation.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains registration timing, merging and ordinary-call behavior.
   * @evidence contracts/portability.md#os-neutral-implementation Native realpath resolves existing root aliases; retained path spellings use Node path resolution.
   * @evidence contracts/performance.md#efficient-algorithms Merging scans existing and incoming path strings once through a Set; map lookup uses the physical root key.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated registration shares the same root entry only when supplied generation authority agrees.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Task resource entries persist until safe forget or scope reclamation; native guards snapshot registrations at admission.
   */
  export function register(resource: {
    /** Existing physical root where cooperating cleanup observes guards. */
    fenceRoot: string;

    /** Exact inputs retained and disclosed in terminal diagnostics. */
    retainedPaths: readonly string[];

    /** Held source-key or shared-cache lease generation, when applicable. */
    generation?: string;

    /** Original source-key task completion capability, when applicable. */
    completionNonce?: string;
  }): void {
    if (current === undefined) return;
    const root = physicalRoot(resource.fenceRoot);
    const previous = current.resources.get(root);
    if (previous !== undefined &&
      ((resource.generation !== undefined && previous.generation !== undefined && resource.generation !== previous.generation) ||
       (resource.completionNonce !== undefined && previous.completionNonce !== undefined && resource.completionNonce !== previous.completionNonce)))
      throw new Error(`ttsc: conflicting native resource generation at ${root}`);
    current.resources.set(root, {
      fenceRoot: root,
      retainedPaths: [...new Set([...(previous?.retainedPaths ?? []), ...resource.retainedPaths.map((entry) => path.resolve(entry))])],
      generation: resource.generation ?? previous?.generation,
      completionNonce: resource.completionNonce ?? previous?.completionNonce,
    });
  }

  /**
   * Register an explicitly selected shared Go cache only in an owned task.
   * Ordinary synchronous consumers retain their existing directory behavior.
   * This adds lifetime protection, without claiming eviction ownership or
   * restricting independent builders that share the cache.
   *
   * @evidence contracts/common.md#principled-implementation Scoped native work creates or resolves the selected Go root before registration so its eventual guard protects the same physical input directory.
   * @evidence contracts/common.md#clear-and-simple-design One helper confines scoped-only directory materialization and registration; ordinary unmanaged callbacks keep their prior path.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Lifetime guard metadata does not convert a user cache into an evictable compiler-owned cache or serialize independent builds.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes lifetime protection, eviction ownership and unchanged ordinary synchronous behavior.
   * @evidence contracts/portability.md#os-neutral-implementation Node recursive mkdir and delegated native realpath preserve existing physical aliases without choosing case policy from an OS name.
   * @evidence contracts/performance.md#efficient-algorithms One directory creation observation and delegated root registration scale with path depth and retained path text.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Shared cache ownership permits concurrent builds but authorizes no compiler-result reuse in this helper.
   * @evidence contracts/performance.md#bound-retention-and-release-resources No process or persistent handle is acquired; the scope owns the root entry and each admitted boundary owns its guard until certified retirement.
   */
  export function registerSharedRoot(root: string): void {
    if (current === undefined) return;
    fs.mkdirSync(root, { recursive: true });
    register({ fenceRoot: root, retainedPaths: [root] });
  }

  /** Forget a safely released registration, never another generation's inputs.
   *
   * @evidence contracts/common.md#principled-implementation Safe tasks remove only the matching registered generation.
   * @evidence contracts/common.md#clear-and-simple-design The current scope and one physical root lookup keep ownership local.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unresolved native ownership prevents forgetting instead of treating cleanup as complete.
   * @evidence contracts/common.md#meaningful-documentation Native prose states safe release and exact-generation exclusion.
   * @evidence contracts/portability.md#os-neutral-implementation Native realpath supplies the same physical root spelling used at registration.
   * @evidence contracts/performance.md#efficient-algorithms One physical resolution and map lookup perform the removal.
   * @evidence contracts/performance.md#reuse-equivalent-work Removing ownership state does not reuse a computed build result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Safe forgetting drops the scope entry; admitted boundaries retain their original resource snapshots.
   */
  export function forget(fenceRoot: string, generation?: string): void {
    if (current === undefined || !canRelease()) return;
    const root = physicalRoot(fenceRoot);
    const resource = current.resources.get(root);
    if (resource !== undefined && (generation === undefined || resource.generation === generation))
      current.resources.delete(root);
  }

  /**
   * Publish every input guard before the native owner may admit a command.
   * Partial publication failure admits no native work and rolls back only this
   * boundary's guards. A failed rollback remains a visible protected record.
   * An unresolved earlier command closes further admission in the same task.
   * Exclusive open registers ownership before any write or close can fail.
   * Failed close/rollback preserves original errors and exact paths for the
   * task owner even if a legacy resolver converts the result to unavailable.
   *
   * @evidence contracts/common.md#principled-implementation All registered guards are written before command admission; publication failure rolls back only files whose exclusive open actually succeeded, including partial writes; close/rollback errors remain original aggregate members.
   * @evidence contracts/common.md#clear-and-simple-design One boundary snapshots registered resources and tracks its exact guard paths.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Publication refusal admits no command; rollback failure stays visible rather than claiming clean release.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains publication ordering and partial-failure effects.
   * @evidence contracts/portability.md#os-neutral-implementation Native directory validation rejects guard links; an actual exclusive descriptor establishes creation ownership before writing, while EEXIST cannot grant deletion authority.
   * @evidence contracts/performance.md#efficient-algorithms For R registered roots, publication writes R records whose bytes scale with retained path text.
   * @evidence contracts/performance.md#reuse-equivalent-work Fresh boundary tokens prohibit accidental reuse of an effectful admission.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each boundary owns one guard per root from exclusive open until certified settlement or successful pre-admission rollback; failed close/rollback is reported across legacy catches, and unknown descriptor closure is never claimed or blindly retried.
   */
  export function begin(boundaryToken: string): void {
    if (current === undefined) return;
    if (!canRelease())
      throw new Error("ttsc: native admission is closed while an earlier boundary has unresolved retirement");
    if (boundaryToken.length === 0 || current.boundaries.has(boundaryToken))
      throw new Error("ttsc: native boundary identity was empty or reused");
    const boundary: Boundary = { token: boundaryToken, state: "not-started", resources: [...current.resources.values()], files: [], candidates: new Set() };
    current.boundaries.set(boundaryToken, boundary);
    try {
      for (const resource of boundary.resources) {
        const directory = guardDirectory(resource.fenceRoot, true)!;
        const file = path.join(directory, `${digest(current.taskToken)}-${digest(boundaryToken)}.json`);
        writeGuard(file, current.taskToken, boundary, resource, "pending", true);
      }
      boundary.state = "pending";
    } catch (error) {
      const failures: unknown[] = [error];
      const operations = current.guardFileOperations ?? fs;
      const retained: string[] = [];
      const owned = [...boundary.files];
      for (const file of boundary.files) {
        try { operations.rmSync(file, { force: true }); }
        catch (failure) { failures.push(failure); retained.push(file); }
      }
      boundary.files = retained;
      const failure = new AggregateError(failures, `ttsc: native guard publication failed before admission; created guards: ${JSON.stringify(owned)}; retained guards: ${JSON.stringify(retained)}; retained paths: ${JSON.stringify(boundary.resources.flatMap((resource) => resource.retainedPaths))}`);
      if (failures.length > 1 || (error instanceof GuardPublicationError && error.cleanupFailed))
        OwnedSynchronousProcess.reportFailure(failure);
      throw failure;
    }
  }

  /**
   * Accept the original boundary owner's classified outcome. A certified
   * terminal outcome is immutable, so a surrounding catch cannot turn a joined
   * command back into unknown. Unknown remains protected if diagnostic writes
   * fail; the pre-admission pending guard already protects its inputs.
   * Candidate close/removal failures retain their original errors and reach the
   * owned task even when later resolver code catches the thrown outcome.
   * Successful removal relinquishes that pathname immediately; only failed
   * removals retain retry authority, and all roots are attempted before failure.
   *
   * @evidence contracts/common.md#principled-implementation Only the original boundary accepts a classified result; safe certificates cannot become unknown through a surrounding catch.
   * @evidence contracts/common.md#clear-and-simple-design The state transition and exact guard-file list centralize completion and unknown publication.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An unknown diagnostic write failure retains the pre-admission guard instead of inferring native closure.
   * @evidence contracts/common.md#meaningful-documentation Native prose states immutable safe outcomes and failure-safe unknown protection.
   * @evidence contracts/portability.md#os-neutral-implementation Node exclusive temporary writes and rename publish metadata; native I/O refusal is propagated.
   * @evidence contracts/performance.md#efficient-algorithms Unknown publication visits registered guard files and serialized path bytes; certified cleanup scans each still-owned guard and failed candidate once before aggregating refusals.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated identical safe outcomes retry cleanup, while conflicting certificates are rejected.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Joined or never-started outcomes relinquish each successfully removed guard or candidate pathname and retain only failed removals for retry; original cleanup failures reach the owned task across legacy catches. Unknown retains guards and failed owned candidates until qualified recovery.
   */
  export function settle(boundaryToken: string, retirement: "joined" | "not-started" | "unknown", reason?: string): void {
    if (current === undefined) return;
    const boundary = current.boundaries.get(boundaryToken);
    if (boundary === undefined) throw new Error("ttsc: native outcome has no admitted boundary");
    if ((boundary.state === "joined" || boundary.state === "not-started") && retirement === "unknown") return;
    if ((boundary.state === "joined" || boundary.state === "not-started") && retirement !== boundary.state)
      throw new Error("ttsc: certified native retirement outcome cannot change");
    if (retirement === "unknown") {
      boundary.state = "unknown";
      boundary.reason = reason ?? "native process-tree retirement was not confirmed";
      const failures: unknown[] = [];
      for (let index = 0; index < boundary.resources.length; index++) {
        try { writeGuard(boundary.files[index]!, current.taskToken, boundary, boundary.resources[index]!, "unknown"); }
        catch (error) { failures.push(error); }
      }
      if (failures.length !== 0) {
        const failure = new AggregateError(failures, diagnostic(boundary));
        if (failures.some((error) => error instanceof GuardPublicationError && error.cleanupFailed))
          OwnedSynchronousProcess.reportFailure(failure);
        throw failure;
      }
      return;
    }
    boundary.state = retirement;
    const failures: unknown[] = [];
    const retained: string[] = [];
    const retainedCandidates = new Set<string>();
    const operations = current.guardFileOperations ?? fs;
    for (const file of [...boundary.files, ...boundary.candidates]) {
      try { operations.rmSync(file, { force: true }); }
      catch (error) {
        failures.push(error);
        if (boundary.candidates.has(file)) retainedCandidates.add(file);
        else retained.push(file);
      }
    }
    boundary.files = retained;
    boundary.candidates = retainedCandidates;
    if (failures.length !== 0) {
      const failure = new AggregateError(failures, `ttsc: certified native guard cleanup failed; retained guards: ${JSON.stringify([...retained, ...retainedCandidates])}; retained paths: ${JSON.stringify(boundary.resources.flatMap((resource) => resource.retainedPaths))}`);
      OwnedSynchronousProcess.reportFailure(failure);
      throw failure;
    }
  }

  /**
   * Run safe cleanup now or retain its original capability after unknown
   * retirement. Deferred callbacks are not treated as completed cleanup.
   *
   * @evidence contracts/common.md#principled-implementation Cleanup executes only when all admitted boundaries certify safety; otherwise its original callback is retained.
   * @evidence contracts/common.md#clear-and-simple-design One predicate chooses immediate execution or FIFO deferral.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Deferral is never reported as completed cleanup.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes retained authority from successful release.
   * @evidence contracts/portability.md#os-neutral-implementation The callback owns native details; this operation sequences opaque cleanup capabilities.
   * @evidence contracts/performance.md#efficient-algorithms One safety scan over task boundaries precedes constant-time append or delegated cleanup.
   * @evidence contracts/performance.md#reuse-equivalent-work Effectful cleanup callbacks are not deduplicated by matching return values.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Deferred callbacks remain with the original scope until qualified recovery succeeds; unknown has no age-based eviction.
   */
  export function release(cleanup: () => void): void {
    if (current !== undefined && !canRelease()) current.deferred.push(cleanup);
    else cleanup();
  }

  /** Observe the installed task's native closure authority without throwing.
   *
   * @evidence contracts/common.md#principled-implementation Every boundary must be joined or never started before cleanup is safe.
   * @evidence contracts/common.md#clear-and-simple-design One task-local predicate serves every release consumer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No PID, clock or unavailable plugin result supplies closure proof.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies a nonthrowing authority observation.
   * @evidence contracts/portability.md#os-neutral-implementation The predicate inspects discriminants without native operations.
   * @evidence contracts/performance.md#efficient-algorithms The scan stops at the first unresolved boundary and takes at most the task boundary count.
   * @evidence contracts/performance.md#reuse-equivalent-work Mutable boundary state is inspected anew, not cached.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Observation allocates transient iteration state and acquires no resource.
   */
  export function canRelease(): boolean {
    if (current === undefined) return true;
    for (const boundary of current.boundaries.values())
      if (boundary.state === "unknown" || boundary.state === "pending") return false;
    return true;
  }

  /**
   * Retry deferred cleanup only with the original task and boundary capability.
   * The caller must supply actual qualified native closure, not a timer or PID
   * observation. No disk-only recovery capability is created by this API.
   *
   * @evidence contracts/common.md#principled-implementation Only the original scope and exact boundary token can apply qualified closure and retry original cleanup.
   * @evidence contracts/common.md#clear-and-simple-design Certified settlement precedes FIFO cleanup, and a throwing callback remains at the head for retry.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Timers and PID observations cannot manufacture recovery authority; losing it leaves terminal quarantine.
   * @evidence contracts/common.md#meaningful-documentation Native prose states caller proof requirements and excludes disk-only recovery.
   * @evidence contracts/portability.md#os-neutral-implementation Settlement and callbacks own native filesystem effects; this coordinator preserves their actual failures.
   * @evidence contracts/performance.md#efficient-algorithms Settlement scans every still-owned guard and candidate before reporting cleanup failures; deferred callbacks run in FIFO order until the first callback failure.
   * @evidence contracts/performance.md#reuse-equivalent-work A previously certified identical outcome can retry failed cleanup without rerunning successful callbacks.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Successful callbacks are removed once; failures retain the original capability for another qualified retry.
   */
  export function recover(scope: Scope, boundaryToken: string, retirement: "joined" | "not-started"): void {
    run(scope, () => {
      const boundary = scope.boundaries.get(boundaryToken);
      if (boundary === undefined || (boundary.state !== "unknown" && boundary.state !== retirement))
        throw new Error("ttsc: recovery does not identify an unresolved native boundary");
      settle(boundaryToken, retirement);
      if (!canRelease()) return;
      while (scope.deferred.length !== 0) {
        const cleanup = scope.deferred[0]!;
        cleanup();
        scope.deferred.shift();
      }
    });
  }

  /** Pending, malformed and unknown guards all prohibit collector reclamation.
   * An exact generation query ignores valid guards for different generations.
   *
   * @evidence contracts/common.md#principled-implementation Any pending, unknown or malformed guard prevents reclamation.
   * @evidence contracts/common.md#clear-and-simple-design One shared reader defines conservative protection for all collectors.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid metadata is protected rather than interpreted as absence.
   * @evidence contracts/common.md#meaningful-documentation Native prose names the protected states and collector purpose.
   * @evidence contracts/portability.md#os-neutral-implementation Guard reading validates native directory identity and rejects links.
   * @evidence contracts/performance.md#efficient-algorithms Reading costs the guard-entry count and total metadata bytes; no PID queries are needed.
   * @evidence contracts/performance.md#reuse-equivalent-work Mutable guard directories are observed for each reclamation decision.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The observation holds no persistent handle and acquires no ownership.
   */
  export function isProtected(fenceRoot: string, generation?: string): boolean {
    const generations = protectedGenerations(fenceRoot);
    return generations === undefined || (generation === undefined ? generations.size !== 0 : generations.has(generation));
  }

  /**
   * Snapshot protected generations for one cooperative collector pass.
   * Undefined protects every generation because metadata is malformed or an
   * unleased shared input has no narrower generation. An empty set protects
   * none. Eviction must still recheck root protection before deleting objects.
   *
   * @evidence contracts/common.md#principled-implementation Valid guards select their exact generations; malformed or unleased records conservatively protect all generations rather than authorizing deletion.
   * @evidence contracts/common.md#clear-and-simple-design A set-or-universal result separates one metadata scan from the collector's per-record membership checks.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The snapshot supplies no native closure proof and cannot replace the final root guard check before object deletion.
   * @evidence contracts/common.md#meaningful-documentation Native prose specifies universal, empty and exact-generation meanings and the snapshot's deletion limitation.
   * @evidence contracts/portability.md#os-neutral-implementation The shared native guard reader validates directory identity and JSON records before generations enter the set.
   * @evidence contracts/performance.md#efficient-algorithms One scan costs guard count and metadata bytes; subsequent record membership avoids rescanning G guards for every one of L lease records.
   * @evidence contracts/performance.md#reuse-equivalent-work One collector pass shares this observed guard snapshot; later passes and final object-eviction admission make fresh native observations.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned set retains at most one token per observed guarded generation and holds no native handle; the collector owns this transient snapshot.
   */
  export function protectedGenerations(fenceRoot: string): ReadonlySet<string> | undefined {
    const generations = new Set<string>();
    for (const guard of readGuards(fenceRoot)) {
      if (guard.record?.generation === undefined) return undefined;
      generations.add(guard.record.generation);
    }
    return generations;
  }

  /**
   * Refuse unknown or malformed exclusive-key ownership. Pending guards remain
   * non-admitting wait states; callers must separately avoid acquisition and
   * binary adoption while isProtected remains true.
   *
   * @evidence contracts/common.md#principled-implementation Unknown or malformed exclusive-key ownership refuses admission; pending guards permit only the existing bounded waiter, whose acquisition and binary adoption remain blocked separately.
   * @evidence contracts/common.md#clear-and-simple-design Admission policy is separate from shared-cache collector protection.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Shared Go cache builds do not invoke this exclusive-key check; their separate leases remain concurrent.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies exclusive admission and its quarantine diagnostic.
   * @evidence contracts/portability.md#os-neutral-implementation Guard paths and retained native paths are reported using Node filesystem spellings.
   * @evidence contracts/performance.md#efficient-algorithms A guard-directory scan and metadata reads precede the first refusal.
   * @evidence contracts/performance.md#reuse-equivalent-work Fresh admission rechecks mutable metadata rather than reusing a prior availability observation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The check acquires no ownership and leaves retained guards untouched.
   */
  export function assertAvailable(fenceRoot: string): void {
    for (const guard of readGuards(fenceRoot)) {
      if (guard.record?.state === "pending") continue;
      throw new Error(`ttsc: source resource is quarantined: ${guard.file}; ${guard.record?.reason ?? "native retirement metadata is unreadable or invalid"}; retained paths: ${JSON.stringify(guard.record?.retainedPaths ?? [fenceRoot])}; qualified native closure or operator-confirmed external closure is required`);
    }
  }

  /**
   * Explain retained input ownership in a bounded wait's failure diagnostic.
   * This reports observed guard bytes and grants no process-closure authority.
   *
   * @evidence contracts/common.md#principled-implementation The first observed guard supplies its state, original reason and exact retained paths without inferring lifetime from PID or elapsed time.
   * @evidence contracts/common.md#clear-and-simple-design One optional diagnostic lets bounded waiters preserve the same metadata interpretation as collector and admission checks.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Pending diagnostic publication does not manufacture a safe outcome or make a timeout reclaim inputs.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the reporting purpose and explicitly excludes closure authority.
   * @evidence contracts/portability.md#os-neutral-implementation The shared native reader validates guard directories; JSON retains actual path spellings in the diagnostic.
   * @evidence contracts/performance.md#efficient-algorithms One guard scan and path-byte formatting occur on diagnostic demand, outside successful waiter polls.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Mutable guard diagnostics are observed anew at the failure boundary rather than cached across transitions.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned string holds no process or directory capability; guard and input retention remain unchanged.
   */
  export function describeProtection(fenceRoot: string): string | undefined {
    const guard = readGuards(fenceRoot)[0];
    if (guard === undefined) return undefined;
    return `native input ownership ${guard.record?.state ?? "invalid"} at ${guard.file}: ${guard.record?.reason ?? "native closure remains unconfirmed"}; retained paths: ${JSON.stringify(guard.record?.retainedPaths ?? [fenceRoot])}`;
  }

  /** Refuse ownership completion or stealing while any native guard remains.
   *
   * @evidence contracts/common.md#principled-implementation Any relevant guard prohibits completion or stealing; exact differing generations do not block their independent lease release.
   * @evidence contracts/common.md#clear-and-simple-design One generation filter serves key retirement and shared Go record cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed metadata cannot authorize generation-based bypass.
   * @evidence contracts/common.md#meaningful-documentation Native prose describes completion and stealing refusal.
   * @evidence contracts/portability.md#os-neutral-implementation The shared reader validates native guard directories and preserves I/O failures.
   * @evidence contracts/performance.md#efficient-algorithms The check scans guard entries and metadata until a relevant protection is found.
   * @evidence contracts/performance.md#reuse-equivalent-work Reclamation authority is observed anew rather than cached across filesystem mutations.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Refusal leaves the original resources and guards owned; the check holds no persistent handle.
   */
  export function assertReleasable(fenceRoot: string, generation?: string): void {
    for (const guard of readGuards(fenceRoot)) {
      if (generation !== undefined && guard.record?.generation !== undefined && guard.record.generation !== generation) continue;
      throw new Error(`ttsc: native input ownership remains protected at ${guard.file}; retained paths: ${JSON.stringify(guard.record?.retainedPaths ?? [fenceRoot])}`);
    }
  }

  /**
   * Refuse recursive clean when a selected physical tree or its ancestors
   * contain a guard. Terminal links are not followed. Scans acquire no held
   * directory identity; callers retain the existing deletion-race premise.
   *
   * @evidence contracts/common.md#principled-implementation A whole-tree and ancestor check prevents recursive deletion of guarded inputs while terminal links remain unlinkable.
   * @evidence contracts/common.md#clear-and-simple-design An iterative directory stack and ancestor walk separate descendant guards from enclosing ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Links are not traversed and unknown guards cannot be treated as safe deletion targets.
   * @evidence contracts/common.md#meaningful-documentation Native prose states terminal-link behavior and the existing deletion-race limitation.
   * @evidence contracts/portability.md#os-neutral-implementation Node lstat distinguishes actual terminal links; callers supply physically pinned ancestor paths.
   * @evidence contracts/performance.md#efficient-algorithms The scan costs visited directories and guard metadata bytes; full traversal is necessary because guards may exist in any selected descendant.
   * @evidence contracts/performance.md#reuse-equivalent-work Each clean transaction observes mutable guards; no cross-clean index supplies stale authority.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Only path strings and a directory stack are retained during the call; no held directory identity prevents later replacement.
   */
  export function assertCleanable(target: string): void {
    const resolved = path.resolve(target);
    let terminalLink = false;
    try { terminalLink = fs.lstatSync(resolved).isSymbolicLink(); }
    catch (error) { if (!missing(error)) throw error; }
    let ancestor = terminalLink ? path.dirname(resolved) : resolved;
    for (;;) {
      assertReleasable(ancestor);
      const parent = path.dirname(ancestor);
      if (parent === ancestor) break;
      ancestor = parent;
    }
    const pending = terminalLink ? [] : [resolved];
    while (pending.length !== 0) {
      const directory = pending.pop()!;
      let stats: fs.Stats;
      try { stats = fs.lstatSync(directory); }
      catch (error) { if (missing(error)) continue; throw error; }
      if (!stats.isDirectory() || stats.isSymbolicLink()) continue;
      assertReleasable(directory);
      for (const entry of fs.readdirSync(directory, { withFileTypes: true }))
        if (entry.isDirectory() && !entry.isSymbolicLink() && entry.name !== GUARD_DIRECTORY)
          pending.push(path.join(directory, entry.name));
    }
  }
}

/**
 * A registered physical input root and its optional exact source/lease generation.
 *
 * Optional generation and nonce preserve existing owner authority while path lists explain retained inputs.
 * One resource combines its root, diagnostic input paths and exact generation identity.
 * A root entry never equates PID identity with native closure.
 * Field comments identify ownership and diagnostic purpose.
 * Native paths are strings whose physical root was resolved at registration.
 * This type executes no algorithm.
 * The type grants no equivalent-result reuse.
 * Runtime scope and boundary owners govern the represented resource lifetime.
 */
interface Resource {
  /** Observed physical directory holding the guard. */
  fenceRoot: string;

  /** Exact input spellings disclosed by the original owner. */
  retainedPaths: string[];

  /** Held key or Go lease generation, absent for unleased shared roots. */
  generation?: string;

  /** Original key completion capability, absent for Go roots. */
  completionNonce?: string;
}

/**
 * One original command admission and its exact input-guard publication set.
 *
 * State separates unresolved admission from qualified joined or never-started closure.
 * One boundary stores its token, immutable snapshot and owned guard paths.
 * Unknown is represented explicitly instead of converted to successful cleanup.
 * Native prose identifies per-command ownership and publication scope.
 * File strings address native guard entries; classification comes from the native owner.
 * This type declares state without scanning or publishing.
 * A boundary identity cannot be reused for another admission.
 * The task owner retains this record and its input snapshot until qualified completion or terminal quarantine.
 */
interface Boundary {
  /** Original command admission token. */
  token: string;

  /** Explicit closure classification; unresolved states prohibit cleanup. */
  state: "pending" | "joined" | "not-started" | "unknown";

  /** Native owner diagnosis when closure is unknown. */
  reason?: string;

  /** Resource snapshot taken before native command admission. */
  resources: Resource[];

  /** Exclusively created guard entries still owned, including partial writes. */
  files: string[];

  /** Exclusively created update candidates whose removal has not succeeded. */
  candidates: Set<string>;
}

/**
 * Cooperating-version metadata that preserves input ownership without granting recovery authority.
 *
 * Version, exact task/boundary identity and pending/unknown states distinguish the publication contract.
 * One JSON record carries diagnostic paths and optional exact generation identity.
 * Neither process identity nor a timestamp can authorize reclamation from these bytes.
 * Native prose explains cooperation and the lack of recovery authority.
 * Native path strings preserve diagnostic spellings; guard directory identity is validated separately.
 * This type executes no metadata reads or scans.
 * Guard identity does not imply compiler-result equivalence.
 * Publication and qualified settlement own record acquisition and deletion; unknown records have no age expiry.
 */
interface GuardRecord {
  /** Cooperative JSON protocol revision. */
  version: 1;

  /** Original request identity; this string alone grants no recovery. */
  taskToken: string;

  /** Exact command admission identity. */
  boundaryToken: string;

  /** Both persisted states prohibit reclamation. */
  state: "pending" | "unknown";

  /** Original native-owner refusal, when diagnostic publication succeeded. */
  reason?: string;

  /** Exact retained input paths for terminal diagnosis. */
  retainedPaths: string[];

  /** Held key/lease generation, absent for unleased shared inputs. */
  generation?: string;

  /** Original source-key completion identity, absent for Go roots. */
  completionNonce?: string;
}

/**
 * Encode an opaque identity into a fixed safe guard filename component.
 *
 * SHA-256 hex encoding avoids path separators in arbitrary task tokens.
 * One standard hash operation owns filename encoding.
 * No consumer or expected result is special-cased.
 * Native prose states the filename purpose rather than a security certificate.
 * Hex output is a filename component on supported Node filesystems.
 * Hashing costs token bytes and produces fixed-size output.
 * Repeated hashing is local identity encoding; no effectful work is cached.
 * The temporary hash object holds no persistent resource.
 */
function digest(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Recognize only filesystem absence codes accepted by conservative guard lookup.
 *
 * ENOENT and ENOTDIR denote absent path components; other errors must remain visible.
 * One structural code predicate supports unknown error values.
 * Permission and malformed metadata errors cannot be mistaken for absence.
 * Native prose names the limited absence interpretation.
 * Node native error codes express absence without OS-name branching.
 * A fixed set of property/code checks takes constant work.
 * Each actual error is classified independently.
 * The predicate retains no handles or historical error registry.
 */
function missing(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

/**
 * Resolve an existing native root to the physical spelling used by its registration.
 *
 * Native realpath observes actual filesystem aliases before map indexing.
 * One Node filesystem primitive owns canonical spelling.
 * Lexical path normalization alone is not treated as physical identity.
 * Native prose explains the existing-root premise.
 * realpath.native resolves physical identity without assuming a platform case rule.
 * Native ancestor resolution and path text drive cost.
 * Mutable native identity is resolved per registration or lookup.
 * The operation holds no directory handle and cannot prevent later namespace replacement.
 */
function physicalRoot(root: string): string {
  return fs.realpathSync.native(path.resolve(root));
}

/**
 * Validate or create the ordinary native directory holding one root's guards.
 *
 * lstat rejects links and resolved-parent identity keeps metadata under the selected physical root.
 * One helper centralizes directory creation and boundary validation.
 * Only absence may omit lookup; unsafe aliases and I/O failures do not authorize deletion.
 * Native prose explains guard containment and lookup/create behavior.
 * Native realpath and lstat inspect actual links and parent identity on supported filesystems.
 * Directory creation and metadata resolution scale with ancestor depth and path text.
 * Native observations are refreshed because namespace identity can change.
 * No directory handle is retained; the existing namespace ownership premise remains necessary.
 */
function guardDirectory(root: string, create: boolean): string | undefined {
  const directory = path.join(root, GUARD_DIRECTORY);
  if (create) fs.mkdirSync(directory, { recursive: true });
  let stats: fs.Stats;
  try { stats = fs.lstatSync(directory); }
  catch (error) { if (!create && missing(error)) return undefined; throw error; }
  if (!stats.isDirectory() || stats.isSymbolicLink() || path.dirname(fs.realpathSync.native(directory)) !== physicalRoot(root))
    throw new Error(`ttsc: unsafe native retirement guard directory: ${directory}`);
  return directory;
}

/**
 * Publish one boundary's metadata with exclusive initial creation or atomic replacement.
 *
 * Exclusive open owns the actual descriptor and registers an initial file before writing; a failed open never permits pathname deletion. Later updates own a unique candidate until successful rename transfers it to the guard.
 * One serializer and descriptor-based publication path preserve task, boundary and resource identity; a private aggregate distinguishes write errors from ownership cleanup failures.
 * Failed unknown replacement leaves the previous guard conservative rather than authorizing release.
 * Native prose distinguishes initial admission publication from later diagnostics.
 * Node exclusive writes and rename expose real filesystem refusal; no cross-platform shell syntax is used.
 * Serialization and writes scale with token and retained path bytes.
 * Effectful publications run anew for each native boundary transition.
 * Close is attempted once after writing and its failure is never treated as closure. Initial rollback belongs to begin; update candidates enter the owned set after exclusive open and leave it only on successful rename or removal. Failed candidate removal retains exact authority for qualified recovery. Write, close, rename and removal failures remain original aggregate members; cleanup failures are reported across legacy catches.
 */
function writeGuard(file: string, taskToken: string, boundary: Boundary, resource: Resource, state: GuardRecord["state"], initial = false): void {
  const bytes = JSON.stringify({ version: 1, taskToken, boundaryToken: boundary.token, state, reason: boundary.reason, ...resource });
  const operations = current?.guardFileOperations ?? fs;
  const candidate = initial ? file : `${file}.${crypto.randomBytes(16).toString("hex")}.tmp`;
  // Open is the ownership transition. An EEXIST refusal must never cause
  // deletion of the pathname this boundary did not create.
  const descriptor = operations.openSync(candidate, "wx");
  if (initial) boundary.files.push(file);
  else boundary.candidates.add(candidate);
  const failures: unknown[] = [];
  let cleanupFailed = false;
  let published = false;
  try {
    operations.writeFileSync(descriptor, bytes);
  } catch (error) { failures.push(error); }
  try { operations.closeSync(descriptor); }
  catch (error) { failures.push(error); cleanupFailed = true; }
  if (!initial) {
    if (failures.length === 0) {
      try { operations.renameSync(candidate, file); published = true; boundary.candidates.delete(candidate); }
      catch (error) { failures.push(error); }
    }
    if (!published) {
      try { operations.rmSync(candidate, { force: true }); boundary.candidates.delete(candidate); }
      catch (error) { failures.push(error); cleanupFailed = true; }
    }
  }
  if (failures.length !== 0)
    throw new GuardPublicationError(failures, `ttsc: native guard file publication failed at ${candidate}; retained paths: ${JSON.stringify(resource.retainedPaths)}`, cleanupFailed);
}

/**
 * Original publication errors plus the distinction between failed writing and
 * failed ownership cleanup. Only cleanup failures need an additional report
 * across legacy unavailable conversion; no native process was admitted merely
 * by creating a guard. The array preserves original error references, and the
 * caller supplies exact paths in the message. This private classification
 * acquires no resources and cannot authorize recovery or cached result reuse.
 */
class GuardPublicationError extends AggregateError {
  /** Whether a real close or owned-candidate removal refused cleanup. */
  readonly cleanupFailed: boolean;

  constructor(errors: unknown[], message: string, cleanupFailed: boolean) {
    super(errors, message);
    this.cleanupFailed = cleanupFailed;
  }
}

/**
 * Observe all root guards conservatively, treating invalid entries as protected.
 *
 * Version, token-derived filename, states and field shapes validate the cooperative JSON protocol.
 * A single directory map serves admission, collectors and clean.
 * Unexpected entries or parse failures do not become empty ownership.
 * Native prose identifies conservative parsing and missing-directory behavior.
 * Native directory validation rejects aliased metadata roots; entry types and actual JSON bytes are observed.
 * Reading costs guard count and total metadata bytes, including validation hashing.
 * Mutable guards are reread for each ownership decision.
 * Only transient entry/JSON/path data are retained; this reader grants no recovery capability.
 */
function readGuards(root: string): Array<{ file: string; record?: GuardRecord }> {
  const directory = guardDirectory(root, false);
  if (directory === undefined) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const file = path.join(directory, entry.name);
    if (!entry.isFile() || entry.isSymbolicLink()) return { file };
    try {
      const record = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<GuardRecord> | null;
      if (record === null || record.version !== 1 || typeof record.taskToken !== "string" || record.taskToken.length === 0 || typeof record.boundaryToken !== "string" || record.boundaryToken.length === 0 ||
        entry.name !== `${digest(record.taskToken)}-${digest(record.boundaryToken)}.json` || (record.reason !== undefined && typeof record.reason !== "string") ||
        (record.state !== "pending" && record.state !== "unknown") || !Array.isArray(record.retainedPaths) || !record.retainedPaths.every((entry) => typeof entry === "string") ||
        (record.generation !== undefined && typeof record.generation !== "string") || (record.completionNonce !== undefined && typeof record.completionNonce !== "string")) return { file };
      return { file, record: record as GuardRecord };
    } catch { return { file }; }
  });
}

/**
 * Describe unknown retirement with its boundary and exact retained input paths.
 *
 * The original boundary snapshot supplies paths without guessing a process lifetime.
 * One error message states reason, retained paths and required qualified recovery.
 * An error message does not certify closure or successful cleanup.
 * Native prose identifies diagnostic purpose.
 * JSON encoding preserves native path strings in the diagnostic.
 * Formatting scans retained paths and their text bytes.
 * Diagnostics reflect the current boundary reason, without caching a previous failure.
 * The returned string owns no native handle or cleanup authority.
 */
function diagnostic(boundary: Boundary): string {
  return `ttsc: native retirement is unknown for ${boundary.token}: ${boundary.reason}; retained paths: ${JSON.stringify(boundary.resources.flatMap((resource) => resource.retainedPaths))}; qualified native closure or operator-confirmed external closure is required`;
}

const GUARD_DIRECTORY = ".ttsc-native-retirements";
let current: SourceNativeRetirement.Scope | undefined;

import crypto from "node:crypto";
import path from "node:path";
import { Worker } from "node:worker_threads";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import { pluginBuildEnvironment } from "./pluginBuildEnvironment";

/**
 * Share native build-environment observations between synchronous clients and
 * asynchronous hosts. Variables and pre-read external metadata qualify every
 * reading; an absent or stale cached reading supplies no authority.
 *
 * Cold asynchronous reads run in an exclusively owned worker. Its complete
 * environment snapshot is passed explicitly to the native reader. Publication
 * rechecks both current host variables and external witnesses after transfer.
 *
 * @evidence contracts/common.md#principled-implementation Current complete environment identity and native pre-read metadata qualify publication and reuse; a worker's returned digest alone supplies no authority.
 * @evidence contracts/common.md#clear-and-simple-design One owner shares observation records across synchronous reads, cache-only proof and asynchronous preparation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cold preparation performs the same actual native Go/toolchain reading off-thread; failed or stale observations are never replaced by producer-expected state.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes preparation, publication and cache-only authority; members document their separate execution responsibilities.
 * @evidence contracts/portability.md#os-neutral-implementation Complete environment snapshots use the shared native-name merger; metadata witnesses preserve actual native filesystem and link identity.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Individual members own variable indexing, witness validation and native preparation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The members specify the invalidation and sharing boundaries.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Readings are replaced per directory/environment key; historical keys remain process-owned. One unreferenced worker is retained idle, active requests queue without detached listener or process-global environment mutation.
 */
export namespace PluginBuildEnvironmentReadings {
  /**
   * The native digest and first-read path evidence transported by a worker.
   *
   * @evidence contracts/common.md#principled-implementation A digest remains paired with every pre-read external-path witness; representation alone grants no current authority.
   * @evidence contracts/common.md#clear-and-simple-design One transfer record carries the native reading and its validity premises.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The record contains actual observed metadata rather than a producer-expected digest with no evidence.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the provenance and transfer responsibility of the fields.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This transport type performs no native operation; the witness and reader own identity semantics.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A record type defines representation; reading and validation members own computation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type grants no reuse authority on its own.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The creating request or process memo owns this record's lifetime.
   */
  export interface Reading {
    readonly environment: string;
    readonly witness: PluginBuildEnvironmentWitness.Record;
  }

  const readings = new Map<string, Reading>();
  const pending = new Map<string, Promise<string>>();
  let worker: Worker | undefined;
  let queue: Promise<void> = Promise.resolve();

  /**
   * Return a current proven reading without starting any native probe.
   * Undefined requires preparation or invalidation, rather than a cold fallback.
   *
   * @evidence contracts/common.md#principled-implementation Both current full variables and every external-path witness must match before cached authority is returned.
   * @evidence contracts/common.md#clear-and-simple-design One optional digest boundary distinguishes usable proof from unavailable proof.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A stale or absent reading returns undefined instead of trusting a pathname, source watcher or reported expected digest.
   * @evidence contracts/common.md#meaningful-documentation The prose explicitly excludes native subprocess and cold-content preparation.
   * @evidence contracts/portability.md#os-neutral-implementation Native metadata and canonical environment names determine equality without OS-wide casing guesses.
   * @evidence contracts/performance.md#efficient-algorithms Sorted variable serialization costs O(V log V) and witness validation O(P) metadata probes; no Go process or SDK byte hashing runs here.
   * @evidence contracts/performance.md#reuse-equivalent-work Only a still-qualified directory/environment reading is shared.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The operation borrows a process-owned record and retains no request history.
   */
  export function cached(directory: string): string | undefined {
    const known = readings.get(key(directory, process.env));
    return known !== undefined && PluginBuildEnvironmentWitness.holds(known.witness)
      ? known.environment
      : undefined;
  }

  /**
   * Read synchronously for clients whose API owns synchronous native work.
   * Explicit refresh preserves the original fresh-comparison semantics.
   *
   * @evidence contracts/common.md#principled-implementation The same native reader constructs the digest and pre-read witness; optional reuse still requires current variables and external metadata.
   * @evidence contracts/common.md#clear-and-simple-design The synchronous boundary shares cached authority and delegates fresh observation to its owning reader.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A requested refresh actually probes the selected native toolchain.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies the synchronous execution owner and explicit refresh meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Native Go selection and filesystem witnesses remain delegated to the shared reader.
   * @evidence contracts/performance.md#efficient-algorithms Hits require variable sorting and witness metadata; misses pay the actual native toolchain/content work once.
   * @evidence contracts/performance.md#reuse-equivalent-work Synchronous and asynchronous clients share the same qualified readings.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retention belongs to the namespace; this call publishes one replacement record.
   */
  export function read(directory: string, refresh = false): string {
    const known = refresh ? undefined : cached(directory);
    if (known !== undefined) return known;
    const env = SidecarEnvironment.merge(process.env);
    const witness: PluginBuildEnvironmentWitness.Record = new Map();
    const environment = pluginBuildEnvironment(directory, env, witness);
    readings.set(key(directory, env), { environment, witness });
    return environment;
  }

  /**
   * Prepare native authority off the host thread, sharing equivalent concurrent
   * requests. A changed environment or witness during transfer refuses the
   * reading; the caller's admission/recovery policy owns a fresh attempt.
   * Failed workers retire and reject; later requests can create a new worker.
   *
   * @evidence contracts/common.md#principled-implementation Worker results publish only under their exact current variable identity and still-current native pre-read witness; changed or unwitnessable transfer windows reject instead of publishing authority or retrying indefinitely.
   * @evidence contracts/common.md#clear-and-simple-design Qualified hits return immediately; equivalent misses share one pending promise and exclusive queued worker request.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Go/environment/SDK preparation occurs in the worker rather than blocking the async host or fabricating a digest from compiler output.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains equivalent sharing, freshness refusal and failed-worker recovery.
   * @evidence contracts/portability.md#os-neutral-implementation Explicit complete environment snapshots and native worker paths preserve host identity and avoid shell commands.
   * @evidence contracts/performance.md#efficient-algorithms Qualified hits inspect variables/witnesses; misses transfer environment and witness bytes once per equivalent request and serialize native preparation on one warm worker.
   * @evidence contracts/performance.md#reuse-equivalent-work Pending identity is directory plus complete variables; the warm worker shares native toolchain memos while published authority still requires fresh witness validation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Pending entries are removed in finally, terminal settlement removes listeners, idle worker is unreferenced and a failed worker terminates; active requests have no implicit timeout.
   */
  export async function prepare(directory: string, refresh = false): Promise<string> {
    const known = refresh ? undefined : cached(directory);
    if (known !== undefined) return known;
    const env = SidecarEnvironment.merge(process.env);
    const identity = key(directory, env);
    const existing = pending.get(identity);
    if (existing !== undefined) return existing;
    const request = (async () => {
      const reading = await observe(directory, env);
      if (identity !== key(directory, process.env) || !PluginBuildEnvironmentWitness.holds(reading.witness))
        throw new Error(`ttsc: plugin build environment could not be qualified for ${directory}`);
      readings.set(identity, reading);
      return reading.environment;
    })();
    pending.set(identity, request);
    try {
      return await request;
    } finally {
      if (pending.get(identity) === request) pending.delete(identity);
    }
  }

  function key(directory: string, env: NodeJS.ProcessEnv): string {
    const variables = crypto.createHash("sha256");
    for (const [name, value] of Object.entries(SidecarEnvironment.merge(env)).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0))
      if (value !== undefined) variables.update(`${name.length}:${name}${value.length}:${value}\0`);
    return `${directory}\0${variables.digest("hex")}`;
  }

  function observe(directory: string, env: NodeJS.ProcessEnv): Promise<Reading> {
    const request = queue.then(() => new Promise<Reading>((resolve, reject) => {
      const current = acquireWorker();
      current.ref();
      let settled = false;
      const release = (reusable: boolean) => {
        if (settled) return false;
        settled = true;
        current.off("message", onMessage);
        current.off("error", onError);
        current.off("exit", onExit);
        if (reusable) current.unref();
        else {
          if (worker === current) worker = undefined;
          void current.terminate();
        }
        return true;
      };
      const onMessage = (reply: Reading | { thrown: Error }) => {
        if (!release(true)) return;
        if ("thrown" in reply) reject(reply.thrown);
        else resolve(reply);
      };
      const onError = (error: Error) => { if (release(false)) reject(error); };
      const onExit = (code: number) => { if (release(false)) reject(new Error(`ttsc: build environment worker exited with code ${code} before answering`)); };
      current.on("message", onMessage);
      current.on("error", onError);
      current.on("exit", onExit);
      try { current.postMessage({ directory, env }); }
      catch (error) { release(false); reject(error); }
    }));
    queue = request.then(() => undefined, () => undefined);
    return request;
  }

  function acquireWorker(): Worker {
    if (worker !== undefined) return worker;
    const created = new Worker(path.join(__dirname, "pluginBuildEnvironmentWorker.js"));
    worker = created;
    const retire = () => { if (worker === created) worker = undefined; };
    // Idle death must retire the cached thread without an unhandled error;
    // active requests additionally own their terminal rejection listeners.
    created.on("error", retire);
    created.on("exit", retire);
    return created;
  }
}

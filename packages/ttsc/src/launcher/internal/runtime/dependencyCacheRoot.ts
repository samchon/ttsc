import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeManifestRegistry } from "./RuntimeManifestRegistry";
import { isLocalProcessGone } from "./isLocalProcessGone";

/**
 * The directory dependency builds are cached under.
 *
 * A plugin-descriptor evaluator keeps its builds beside its own result file, so
 * the parent's cleanup of that evaluation removes them too. Otherwise the first
 * manifest's per-run `depCacheDir` is used, shared by every process of one run
 * and removed with it.
 *
 * Without any manifest there is no run to share with: a child whose environment
 * dropped `TTSX_RUNTIME_MANIFEST`, or one that loads its first TypeScript after
 * the launcher removed the manifest. Its builds go to a directory private to
 * this process and removed when it exits. A shared, persistent directory used
 * to serve that case, keyed only by the tsconfig path, so an edited dependency
 * kept running its first build until the temp directory was cleared
 * (samchon/ttsc#1405). A process that could not remove its directory (it was
 * killed) is swept by the next one that starts.
 *
 * @param env Environment to read the descriptor-evaluation variables from.
 */
export function dependencyCacheRoot(
  env: NodeJS.ProcessEnv = process.env,
): string {
  // Descriptor evaluators are disposable and must not leave one isolated emit
  // generation in the shared temp cache per load. Their result file already
  // lives in the evaluator-owned directory that the parent removes in
  // `finally`; put dependency emits beside it so that cleanup owns both.
  if (
    env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1" &&
    typeof env.TTSC_PLUGIN_DESCRIPTOR_OUT === "string" &&
    path.isAbsolute(env.TTSC_PLUGIN_DESCRIPTOR_OUT)
  ) {
    return path.join(
      path.dirname(env.TTSC_PLUGIN_DESCRIPTOR_OUT),
      "dependency-cache",
    );
  }
  const owner = RuntimeManifestRegistry.runtimeManifests().find(
    (candidate) => candidate.depCacheDir.length !== 0,
  );
  return owner !== undefined ? owner.depCacheDir : processPrivateRoot();
}

/** Parent of the per-process directories of manifest-less runtimes. */
const PROCESS_ROOT_PARENT = path.join(os.tmpdir(), "ttsx-dep");

/** Prefix of a per-process directory's name, which the sweep recognizes. */
const PROCESS_ROOT_PREFIX = "process-";

/** Owner record inside a per-process directory. */
const PROCESS_ROOT_OWNER = "owner.json";

let processRoot: string | undefined;

/**
 * This process's private dependency cache, created on first use with an owner
 * record, and removed on exit. Creating it first sweeps the directories of
 * processes on this host that are gone.
 */
function processPrivateRoot(): string {
  if (processRoot !== undefined) return processRoot;
  sweepAbandonedProcessRoots();
  const directory = path.join(
    PROCESS_ROOT_PARENT,
    `${PROCESS_ROOT_PREFIX}${process.pid}-${crypto.randomBytes(8).toString("hex")}`,
  );
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, PROCESS_ROOT_OWNER),
    JSON.stringify({ hostname: os.hostname(), pid: process.pid }),
    "utf8",
  );
  process.once("exit", () => {
    try {
      fs.rmSync(directory, { force: true, recursive: true });
    } catch {
      // Best effort: the next manifest-less process sweeps what remains.
    }
  });
  processRoot = directory;
  return directory;
}

/**
 * Remove the per-process directories whose owner is proven gone. A directory
 * without a readable owner record is left alone: it may belong to a process
 * that has created the directory and not yet written the record.
 */
function sweepAbandonedProcessRoots(): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(PROCESS_ROOT_PARENT);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.startsWith(PROCESS_ROOT_PREFIX)) continue;
    const directory = path.join(PROCESS_ROOT_PARENT, entry);
    try {
      const owner = JSON.parse(
        fs.readFileSync(path.join(directory, PROCESS_ROOT_OWNER), "utf8"),
      ) as { hostname?: unknown; pid?: unknown };
      if (
        typeof owner.hostname === "string" &&
        typeof owner.pid === "number" &&
        isLocalProcessGone({ hostname: owner.hostname, pid: owner.pid })
      ) {
        fs.rmSync(directory, { force: true, recursive: true });
      }
    } catch {
      // Unreadable or concurrently removed: not provably abandoned.
    }
  }
}

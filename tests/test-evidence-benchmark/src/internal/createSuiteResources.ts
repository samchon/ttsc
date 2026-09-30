import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Owns only this invocation's temporary suite and newly created Windows stores.
 *
 * @evidence contracts/common.md#principled-implementation Own mkdtemp establishes the suite identity; an exact workspace-derived store must be absent before preparation, then its native identity and every ancestor are captured before reclamation. Arbitrary paths and historical stores cannot enter this registry.
 * @evidence contracts/common.md#clear-and-simple-design The owner exposes its directory, a before/after preparation pair and final release. Private native identity checks serve both acquisition and deletion rather than trusting later mutable npmrc contents.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not follow replacement links, delete shared caches, suppress cleanup failures or alter measured campaign retention. Unsafe or replaced resources remain on disk with an error.
 * @evidence contracts/common.md#meaningful-documentation Describes invocation ownership, absence-before-creation and the mandatory child-join boundary; callers must finish their children before release and report any rejected reclamation.
 * @evidence contracts/performance.md#efficient-algorithms Captures and verifies one ancestor chain per owned root, linear in path depth; recursive deletion visits the owned tree once with bounded native retries.
 * @evidence contracts/performance.md#reuse-equivalent-work The suite root and at most one store per arm share one ownership registry. Identity snapshots are reused only after comparing current native identities, never by pathname alone.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Owns one temporary suite and at most two external stores until awaited suite completion. All independent removals are attempted and failures aggregated; replacement or busy resources stay visible instead of being silently abandoned.
 * @evidence contracts/portability.md#os-neutral-implementation Uses resolved native paths and bigint filesystem identities. Only Windows needs the drive-local path-keyed store; ordinary directory and ancestor checks reject junctions and symlinks before recursive removal on either platform.
 */
export function createSuiteResources() {
  const directory = fs.mkdtempSync(
    path.join(fs.realpathSync.native(os.tmpdir()), "evidence-benchmark-suite-"),
  );
  const owned = new Map<string, ReturnType<typeof snapshot>>();
  owned.set(directory, snapshot(directory));
  let released = false;

  function snapshot(root: string) {
    const chain: { path: string; device: bigint; inode: bigint }[] = [];
    for (let current = path.resolve(root); ; current = path.dirname(current)) {
      const stat = fs.lstatSync(current, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error(`Suite resource is not an ordinary directory: ${current}`);
      const actual = fs.realpathSync.native(current);
      if ((process.platform === "win32" ? actual.toLowerCase() : actual) !==
          (process.platform === "win32" ? current.toLowerCase() : current))
        throw new Error(`Suite resource has a redirected ancestor: ${current}`);
      chain.push({ path: current, device: stat.dev, inode: stat.ino });
      if (path.dirname(current) === current) break;
    }
    return chain;
  }

  function beforeWorkspace(workspace: string): () => void {
    if (released) throw new Error("The benchmark suite has already been released.");
    const resolved = path.resolve(workspace);
    if (!["plain", "evidence"].some((arm) =>
      resolved === path.join(directory, arm, "workspace")))
      throw new Error(`Workspace is outside the owned suite: ${workspace}`);
    if (process.platform !== "win32") return () => undefined;
    const store = path.join(
      path.parse(resolved).root,
      ".ttsc-vstore",
      crypto.createHash("sha256").update(resolved.toLowerCase()).digest("hex").slice(0, 12),
    );
    try {
      snapshot(path.dirname(store));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    try {
      fs.lstatSync(store);
      throw new Error(`Refusing a preexisting benchmark store: ${store}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return () => {
      try {
        owned.set(store, snapshot(store));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    };
  }

  function release(): void {
    released = true;
    const failures: unknown[] = [];
    // Stores may link into the suite; remove their owned directory entries first.
    for (const [root, expected] of [...owned].reverse()) {
      try {
        const actual = snapshot(root);
        if (actual.length !== expected.length || actual.some((entry, index) =>
          entry.path !== expected[index]!.path ||
          entry.device !== expected[index]!.device ||
          entry.inode !== expected[index]!.inode))
          throw new Error(`Suite resource identity changed before release: ${root}`);
        fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        owned.delete(root);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") owned.delete(root);
        else failures.push(error);
      }
    }
    if (failures.length !== 0)
      throw new AggregateError(failures, "Benchmark suite resources could not be released.");
  }
  return { directory, beforeWorkspace, release };
}

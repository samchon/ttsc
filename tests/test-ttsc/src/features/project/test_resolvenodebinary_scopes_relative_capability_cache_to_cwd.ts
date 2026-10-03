import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveNodeBinary } from "../../../../../packages/ttsc/src/internal/resolveNodeBinary";

/**
 * Retains runtime selection across cwd and executable-state transitions.
 *
 * The same relative spelling selects an actual copied/linked Node in one cwd
 * and falls back in another. An absolute candidate is then unlinked before
 * invalid bytes replace it, preserving the live process executable. A missing
 * relative candidate becomes usable only after real Node bytes are copied in.
 *
 * @evidence contracts/testing.md#behavioral-verification Directly calls resolveNodeBinary six times through its actual native capability probe: relative selection and other-cwd fallback, absolute selection and replacement rejection, then missing and late-created relative selection. Observes original absolute/dev/ino expectations and exact process.execPath fallbacks.
 * @evidence contracts/testing.md#independent-expectations Authored candidate paths and actual fs.statSync device/inode values supply expected selection independently of the resolver. Literal invalid bytes cannot report registerHooks capability. Device/inode comparisons retain the donor's native oracle, without claiming zero-valued identities uniquely prove physical equality.
 * @evidence contracts/testing.md#distinguishing-cases Preserves first/second owned directories, hardlink-or-copy initial input, POSIX 0755 mode, same relative spelling under different cwd, absolute repeat and unlink-before-invalid replacement, and missing-then-created late candidate. Six resolve calls do not imply six fixed children; cache/fallback paths may differ. No new platform skip is introduced.
 * @evidence contracts/testing.md#execution-ownership This named project source unit imports the owning selector and uses actual Node bytes and synchronous native probes without a consumer install, compiler, Go build, product host, foreign replacement or new API. Environments are call-local copies and the late env retains only its explicit TTSC_NODE_BINARY input; production still reads ambient fallback candidates. Original selected-runtime availability assumptions remain, and private-root cleanup failures are aggregated. Body existence certifies neither native execution nor OS-death behavior.
 */
export function test_resolvenodebinary_scopes_relative_capability_cache_to_cwd(): void {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-relative-node-capability-"),
  );
  const failures: Error[] = [];
  const observe = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  try {
    const first = path.join(root, "first");
    const second = path.join(root, "second");
    fs.mkdirSync(first, { recursive: true });
    fs.mkdirSync(second, { recursive: true });
    const name =
      process.platform === "win32" ? "candidate-node.exe" : "candidate-node";
    const candidate = path.join(first, name);
    try {
      fs.linkSync(process.execPath, candidate);
    } catch {
      fs.copyFileSync(process.execPath, candidate);
    }
    if (process.platform !== "win32") fs.chmodSync(candidate, 0o755);
    const relative = `./${name}`;
    const env = { ...process.env, TTSC_NODE_BINARY: relative };
    observe("relative candidate in first cwd", () => {
      assertSameAbsoluteFile(resolveNodeBinary(env, first), candidate);
    });
    observe("same relative candidate absent in second cwd", () => {
      assert.equal(resolveNodeBinary(env, second), process.execPath);
    });

    const absoluteEnv = { ...process.env, TTSC_NODE_BINARY: candidate };
    observe("absolute candidate before replacement", () => {
      assertSameAbsoluteFile(resolveNodeBinary(absoluteEnv, first), candidate);
    });
    // Unlink the candidate before writing: it may be a hardlink to live Node.
    fs.rmSync(candidate);
    fs.writeFileSync(candidate, "not a JavaScript runtime\n", "utf8");
    if (process.platform !== "win32") fs.chmodSync(candidate, 0o755);
    observe("absolute candidate after invalid replacement", () => {
      assertSameAbsoluteFile(
        resolveNodeBinary(absoluteEnv, first),
        process.execPath,
      );
    });

    const late = path.join(
      second,
      process.platform === "win32" ? "late-node.exe" : "late-node",
    );
    const lateEnv: NodeJS.ProcessEnv = {
      TTSC_NODE_BINARY: `.${path.sep}${path.basename(late)}`,
    };
    observe("late relative candidate before creation", () => {
      assert.equal(resolveNodeBinary(lateEnv, second), process.execPath);
    });
    fs.copyFileSync(process.execPath, late);
    if (process.platform !== "win32") fs.chmodSync(late, 0o755);
    observe("late relative candidate after creation", () => {
      assertSameAbsoluteFile(resolveNodeBinary(lateEnv, second), late);
    });
  } catch (cause) {
    failures.push(
      new Error("relative runtime candidate fixture preparation", { cause }),
    );
  } finally {
    observe("relative runtime candidate root cleanup", () => {
      fs.rmSync(root, { recursive: true, force: true });
    });
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "relative runtime candidate observations failed",
    );
}

function assertSameAbsoluteFile(
  actual: string | undefined,
  expected: string,
): void {
  assert.ok(actual !== undefined && path.isAbsolute(actual), String(actual));
  const actualStats = fs.statSync(actual);
  const expectedStats = fs.statSync(expected);
  assert.equal(actualStats.dev, expectedStats.dev);
  assert.equal(actualStats.ino, expectedStats.ino);
}

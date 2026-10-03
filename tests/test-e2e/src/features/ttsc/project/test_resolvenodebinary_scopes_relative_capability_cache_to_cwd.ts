import { TestProject } from "@ttsc/testing";

import { assert, fs, path, resolveNodeBinary } from "../../../internal/ttsc/internal/project";

/**
 * Verifies relative runtime capability probes use current executable state.
 *
 * Two embedders can use the same `./node` spelling from different roots, and a
 * long-lived host can see an absolute candidate replaced after a successful
 * probe. Cached capability must never authorize either different executable.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveNodeBinary selects the real runtime in one cwd, falls back in another, rejects a replaced executable and accepts a late-created runtime.
 * @evidence contracts/testing.md#independent-expectations Real runtime inode/device identity and an authored invalid executable distinguish runtime validity from a cached spelling.
 * @evidence contracts/testing.md#distinguishing-cases resolveNodeBinary selects the real runtime in one cwd, falls back in another, rejects a replaced executable and accepts a late-created runtime.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner directly calls the built owning runtime selector/probe with actual executable fixtures. This is direct selection/cache behavior, not a consumer installation or product host. Same-stem source-unit body c80c82e3e31ada59538f4df9c521eb9a773c130c is authored; its source existence, selection and execution remain separate.
 * @evidenceExclude contracts/e2e.md#necessary-boundary Actual Node subprocesses are owning capability probe operations needed for direct runtime selection semantics, not an installed/native producer/product host connection. Unit-first transfer must preserve the real executable inputs, not replace them with synthetic capabilities.
 * @evidence contracts/e2e.md#shared-execution Six selector calls share the actual running Node and two input roots; cwd change, unlink/replacement and late appearance retain their distinct authorities. Six calls are not six fixed child starts, cache hits or immutable executable ownership certificates; no consumer installation occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked root is retained before hardlink/copy preparation. Candidate is unlinked before invalid bytes are written so the running executable hardlink is not changed. Supplied env is call-local but production ambient candidate fallback remains; synchronous probe return does not establish arbitrary descendant join.
 * @evidence contracts/e2e.md#preserved-coverage Original six calls/relative and absolute authority, actual hardlink-or-copy, invalid runtime bytes, late copy, Windows executable spelling/POSIX mode, exact process.execPath and absolute/dev/ino comparisons remain. Needed owner is tests/test-ttsc/src/features/project/test_resolvenodebinary_scopes_relative_capability_cache_to_cwd.ts; body c80c82e3e31ada59538f4df9c521eb9a773c130c/COMMENT5400609958 is authored with all six original calls and expectations, not executed coverage certification. Runtime/selection/survival unverified and donor retained.
 */
export const test_resolvenodebinary_scopes_relative_capability_cache_to_cwd =
  (): void => {
    const root = TestProject.tmpdir("ttsc-relative-node-capability-");
    TestProject.retainTemporaryDirectory(root, "Runtime capability probe descendants are not joined");
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

    assertSameAbsoluteFile(resolveNodeBinary(env, first), candidate);
    assert.equal(resolveNodeBinary(env, second), process.execPath);

    const absoluteEnv = { ...process.env, TTSC_NODE_BINARY: candidate };
    assertSameAbsoluteFile(resolveNodeBinary(absoluteEnv, first), candidate);
    fs.rmSync(candidate);
    fs.writeFileSync(candidate, "not a JavaScript runtime\n", "utf8");
    if (process.platform !== "win32") fs.chmodSync(candidate, 0o755);
    assertSameAbsoluteFile(
      resolveNodeBinary(absoluteEnv, first),
      process.execPath,
    );

    const late = path.join(
      second,
      process.platform === "win32" ? "late-node.exe" : "late-node",
    );
    const lateEnv: NodeJS.ProcessEnv = {
      TTSC_NODE_BINARY: `.${path.sep}${path.basename(late)}`,
    };
    assert.equal(resolveNodeBinary(lateEnv, second), process.execPath);
    fs.copyFileSync(process.execPath, late);
    if (process.platform !== "win32") fs.chmodSync(late, 0o755);
    assertSameAbsoluteFile(resolveNodeBinary(lateEnv, second), late);
  };

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

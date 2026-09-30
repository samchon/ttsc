import { TestProject } from "@ttsc/testing";

import { assert, fs, path, resolveNodeBinary } from "../../internal/project";

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
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual child or host operation exercises the transport and execution result named in this case; direct in-process decision helpers cannot establish that process outcome.
 * @evidence contracts/e2e.md#shared-execution All authored subcases reuse the fixture and available runtime within this named entry; distinct process results or runtime identities retain their required child lifetime, without a consumer installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject fixtures isolate mutable records and runtime identities. Synchronous child completion or existing session cleanup owns process lifetime; temporary roots remain registered with TestProject for exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage resolveNodeBinary selects the real runtime in one cwd, falls back in another, rejects a replaced executable and accepts a late-created runtime. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_resolvenodebinary_scopes_relative_capability_cache_to_cwd =
  (): void => {
    const root = TestProject.tmpdir("ttsc-relative-node-capability-");
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

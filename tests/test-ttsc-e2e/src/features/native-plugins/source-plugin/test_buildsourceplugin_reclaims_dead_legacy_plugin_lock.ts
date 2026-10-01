import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  child_process,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  inspectPluginBuildLock,
  os,
  path,
  resolveSourceBuildCachePaths,
} from "../../../internal/source-build";

/**
 * Verifies buildSourcePlugin reclaims a dead legacy plugin owner.
 *
 * A killed legacy source-plugin build can leave `<cache-key>.lock` without a
 * published binary. Its same-host owner PID proves the task ended, so ttsc
 * retires that generation and retries the build under a fresh lock.
 *
 * 1. Create an old `.lock` with a dead owner and a crashed fence candidate.
 * 2. Run `buildSourcePlugin` through the fake Go toolchain.
 * 3. Assert the binary is published and the replacement v3 lock is released.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual buildSourcePlugin must retire an old legacy lock with an exited same-host owner, publish its binary through a fresh v3 acquisition and leave inspection released.
 * @evidence contracts/testing.md#independent-expectations A synchronously completed child establishes the recorded dead PID; an explicitly aged legacy path and a crashed candidate establish recovery inputs, and filesystem existence plus the literal released observation define success.
 * @evidence contracts/testing.md#distinguishing-cases A legacy owner and orphan candidate precede a missing-binary build; the exited-child status, published binary and released successor assertions distinguish recovered admission from an uncompleted attempt. Live and remote owner controls belong to inspector cases.
 * @evidence contracts/testing.md#execution-ownership The exported entry calls the shipped builder and inspector with a scripted Go executable over actual filesystem locks and a native exited PID; the stub is an admission fixture, not proof of Go compilation.
 * @evidence contracts/e2e.md#necessary-boundary The builder must connect native PID absence, legacy fence retirement, process-backed tool invocation and v3 finalization. The assertion concerns that admission/publication connection rather than contributor compiler semantics.
 * @evidence contracts/e2e.md#shared-execution One fake executable, module and cache entry are reused for key computation and the recovery build; only the intentionally absent binary requires payload production, and no real contributor rebuild is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private source/cache paths own the aged legacy lock and crashed candidate. TTSC_GO_BINARY and three cache variables are restored in finally; the seed child has exited before ownership is recorded, and the synchronous build owns finalization.
 * @evidence contracts/e2e.md#preserved-coverage Exited-child success, binary existence and exact released inspection remain the original assertions. The stub verifies copied fixture inputs while its literal binary only witnesses publication, not compiler validity.
 */
export const test_buildsourceplugin_reclaims_dead_legacy_plugin_lock = () => {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  writePluginSource(plugin);
  const cacheDir = path.join(root, "cache");

  const fakeGo = createFakeGoBinary(root);
  const saved = {
    go: process.env.TTSC_GO_BINARY,
    cache: process.env.TTSC_CACHE_DIR,
    goCache: process.env.TTSC_GO_CACHE_DIR,
    gocache: process.env.GOCACHE,
  };
  process.env.TTSC_GO_BINARY = fakeGo;
  delete process.env.TTSC_CACHE_DIR;
  delete process.env.TTSC_GO_CACHE_DIR;
  delete process.env.GOCACHE;
  try {
    const key = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: fakeGo,
      overlayDirs: [],
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    const paths = resolveSourceBuildCachePaths(root, cacheDir);
    const cacheEntry = path.join(paths.pluginRoot, key);
    const lockDir = `${cacheEntry}.lock`;
    fs.mkdirSync(cacheEntry, { recursive: true });
    fs.mkdirSync(lockDir, { recursive: true });
    fs.mkdirSync(`${lockDir}.legacy-candidate-${"0".repeat(32)}`);
    const exited = child_process.spawnSync(process.execPath, ["-e", ""], {
      windowsHide: true,
    });
    assert.equal(exited.status, 0);
    fs.writeFileSync(
      path.join(lockDir, "owner.json"),
      `${JSON.stringify({ hostname: os.hostname(), pid: exited.pid })}\n`,
      "utf8",
    );
    const old = new Date(Date.now() - 120_000);
    fs.utimesSync(lockDir, old, old);

    const binary = buildSourcePlugin({
      baseDir: root,
      cacheDir,
      overlayDirs: [],
      pluginName: "stale-lock",
      source: plugin,
      quiet: true,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.equal(fs.existsSync(binary), true);
    assert.deepEqual(inspectPluginBuildLock(lockDir), {
      state: "released",
    });
  } finally {
    restore("TTSC_GO_BINARY", saved.go);
    restore("TTSC_CACHE_DIR", saved.cache);
    restore("TTSC_GO_CACHE_DIR", saved.goCache);
    restore("GOCACHE", saved.gocache);
  }
};

function writePluginSource(root: string): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(root, "main.go"), "package main\n", "utf8");
  for (const file of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "package main\n", "utf8");
  }
}

function restore(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

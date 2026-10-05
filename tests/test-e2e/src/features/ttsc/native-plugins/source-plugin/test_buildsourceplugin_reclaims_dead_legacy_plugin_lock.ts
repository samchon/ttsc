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
} from "../../../../internal/ttsc/internal/source-build";

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
 * @evidence contracts/testing.md#independent-expectations A completed child with error absent, signal null, status0 and positive safe PID supplies the owner input; native process.kill(pid,0) must independently yield ESRCH before recording it. Aged legacy path/candidate and binary existence/literal released prescribe recovery observations.
 * @evidence contracts/testing.md#distinguishing-cases Legacy owner/candidate precede a missing-binary build; exited-child/native-absence guards, publication and released inspection distinguish completed recovery. Candidate removal is not asserted. Live/remote inspector controls have separate owners and require their own execution evidence.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this generic export, invoking the built workspace builder/inspector with scripted Go admission over actual native filesystem locks/PID absence. The fixture does not prove real Go compilation or packed installation.
 * @evidence contracts/e2e.md#necessary-boundary The builder must connect native PID absence, legacy fence retirement, process-backed tool invocation and v3 finalization. The assertion concerns that admission/publication connection rather than contributor compiler semantics.
 * @evidence contracts/e2e.md#shared-execution One scripted executable/module/private cache supplies key computation and actual recovery build, separate from real-Go producer profiles. Missing publication and recovery results are observed, not native process/build totals or shared hits.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked source/cache/root hold the aged lock/candidate; the seed child is independently ESRCH-absent before its owner record. TTSC_GO_BINARY/three cache variables restore their exact original absence/value in finally. Root is conservatively retained because sync builder return/lock finalization does not certify arbitrary descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage Exited-child success, binary existence and exact released inspection remain the original assertions. The stub verifies copied fixture inputs while its literal binary only witnesses publication, not compiler validity.
 */
export const test_buildsourceplugin_reclaims_dead_legacy_plugin_lock = () => {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  TestProject.retainTemporaryDirectory(
    root,
    "legacy lock native graph has no descendant join acknowledgement",
  );
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
    assert.equal(exited.error, undefined, "owner setup child launch error");
    assert.equal(exited.signal, null, "owner setup child terminated by signal");
    assert.equal(exited.status, 0);
    assert.ok(
      Number.isSafeInteger(exited.pid) && exited.pid > 0,
      "owner setup child must supply a positive safe PID",
    );
    let absence: unknown;
    try {
      process.kill(exited.pid, 0);
    } catch (error) {
      absence = error;
    }
    assert.equal(
      (absence as NodeJS.ErrnoException | undefined)?.code,
      "ESRCH",
      "only native ESRCH proves the owner PID absent",
    );
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

import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  path,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies buildSourcePlugin sets ttsc-owned Go build cache.
 *
 * CI runners often restore the ttsc source-plugin cache but not Go's object
 * cache. When the user has not provided `GOCACHE`, ttsc should pass a stable
 * cache directory beside the plugin binary cache so one Actions cache entry can
 * persist both layers.
 *
 * 1. Build a source plugin through the fake Go executable with no user `GOCACHE`.
 * 2. Capture the environment received by `go build`.
 * 3. Assert `GOCACHE` points at `<cache-dir>/go-build`.
 * 4. Build through the managed default cache and assert post-build maintenance
 *    runs even when the pre-build daily marker was just written.
 * 5. Fail another cold build after it writes cache objects and assert the same
 *    forced post-build maintenance still runs without replacing the build
 *    error.
 * 6. Reject default plugin-cache root and content-addressed entry junctions so
 *    neither publication nor metadata writes can escape the owned cache.
 *
 * @evidence contracts/testing.md#behavioral-verification buildSourcePlugin passes its owned GOCACHE, forces post-build maintenance on success and failure, and preserves outside sentinels for linked cache roots, entries and lock generations.
 * @evidence contracts/testing.md#independent-expectations The fake child records GOCACHE and writes deliberately future maintenance markers; changed markers witness a maintenance attempt, not reclaimed object or byte totals. Outside sentinel bytes and entry names remain independent confinement controls.
 * @evidence contracts/testing.md#distinguishing-cases Explicit cache and managed default, successful and failed cold builds, unsafe root/entry, and legacy/v2/v3 linked locks remain asserted; v2 recovery is allowed while legacy/v3 reject.
 * @evidence contracts/testing.md#execution-ownership The exported test_buildsourceplugin_sets_ttsc_owned_go_build_cache entry is discovered by TestExecutor from features/ttsc/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary buildSourcePlugin passes actual executable arguments, cwd, environment and copied workspace inputs through a child process before publication. The fake Go script can fail or record those inputs independently; it proves build orchestration at this process boundary and does not certify native Go compilation.
 * @evidence contracts/e2e.md#shared-execution One fake tool serves eight ordered source-builder requests: explicit cache, managed success and failure, linked root and entry, then legacy/v2/v3 linked locks. Distinct roots and marker values preserve cold and ownership inputs; named failures are collected so another independent request still runs. No process-total or native-compilation reduction is measured.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked root is retained before fixture preparation. Seven prior environment values are captured; the outer try encloses the first mutation and finally restores absence or exact values. Fake build controls start absent, and exit17 is cleared after the failure row even if its assertions fail. Synchronous builder returns do not certify arbitrary descendant closure; retained fixtures and actual trace/join evidence remain future execution obligations.
 * @evidence contracts/e2e.md#preserved-coverage buildSourcePlugin passes its owned GOCACHE, forces post-build maintenance on success and failure, and preserves outside sentinels for linked cache roots, entries and lock generations. These assertions stay in test_buildsourceplugin_sets_ttsc_owned_go_build_cache with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_buildsourceplugin_sets_ttsc_owned_go_build_cache = () => {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  TestProject.retainTemporaryDirectory(root);
  const plugin = path.join(root, "plugin");
  writePluginSource(plugin);
  const cacheDir = path.join(root, "cache");
  const capture = path.join(root, "go-env.json");

  const fakeGo = createFakeGoBinary(root);
  const previousGo = process.env.TTSC_GO_BINARY;
  const previousGoCache = process.env.GOCACHE;
  const previousTtscGoCache = process.env.TTSC_GO_CACHE_DIR;
  const previousCapture = process.env.FAKE_GO_CAPTURE_ENV_FILE;
  const previousObjectCount = process.env.FAKE_GO_BUILD_CACHE_OBJECT_COUNT;
  const previousMarkerValue = process.env.FAKE_GO_BUILD_CACHE_MARKER_VALUE;
  const previousExitCode = process.env.FAKE_GO_BUILD_EXIT_CODE;
  const failures: Error[] = [];
  try {
    process.env.TTSC_GO_BINARY = fakeGo;
    process.env.FAKE_GO_CAPTURE_ENV_FILE = capture;
    delete process.env.GOCACHE;
    delete process.env.TTSC_GO_CACHE_DIR;
    delete process.env.FAKE_GO_BUILD_EXIT_CODE;
    delete process.env.FAKE_GO_BUILD_CACHE_OBJECT_COUNT;
    delete process.env.FAKE_GO_BUILD_CACHE_MARKER_VALUE;
    try {
      buildSourcePlugin({
        baseDir: root,
        cacheDir,
        overlayDirs: [],
        pluginName: "go-build-cache",
        source: plugin,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      const captured = JSON.parse(fs.readFileSync(capture, "utf8")) as {
        GOCACHE: string | null;
      };
      assert.equal(captured.GOCACHE, path.join(cacheDir, "go-build"));

    } catch (error) {
      failures.push(new Error("explicit GOCACHE", { cause: error }));
    }

    try {
      const managedRoot = path.join(root, "managed");
      fs.mkdirSync(path.join(managedRoot, "node_modules"), { recursive: true });
      writePluginSource(managedRoot);
      process.env.FAKE_GO_BUILD_CACHE_OBJECT_COUNT = "3";
      const buildMarkerValue = String(Date.now() + 24 * 60 * 60 * 1000);
      process.env.FAKE_GO_BUILD_CACHE_MARKER_VALUE = buildMarkerValue;
      buildSourcePlugin({
        baseDir: managedRoot,
        overlayDirs: [],
        pluginName: "managed-post-build-gc",
        source: managedRoot,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
      const managedGoCache = path.join(
        managedRoot,
        "node_modules",
        ".cache",
        "ttsc",
        "go-build",
      );
      const managedMarker = path.join(managedGoCache, ".ttsc-gc");
      assert.equal(fs.existsSync(managedMarker), true);
      assert.notEqual(
        fs.readFileSync(managedMarker, "utf8").trim(),
        buildMarkerValue,
        "managed cold builds must enforce GC after go build",
      );

    } catch (error) {
      failures.push(new Error("managed success maintenance", { cause: error }));
    }

    try {
      const failedRoot = path.join(root, "failed-managed");
      fs.mkdirSync(path.join(failedRoot, "node_modules"), { recursive: true });
      writePluginSource(failedRoot);
      process.env.FAKE_GO_BUILD_EXIT_CODE = "17";
      const failedMarkerValue = String(Date.now() + 48 * 60 * 60 * 1000);
      process.env.FAKE_GO_BUILD_CACHE_MARKER_VALUE = failedMarkerValue;
      assert.throws(
        () =>
          buildSourcePlugin({
            baseDir: failedRoot,
            overlayDirs: [],
            pluginName: "managed-failed-post-build-gc",
            source: failedRoot,
            quiet: true,
            ttscVersion: "1.0.0",
            tsgoVersion: "7.0.0-dev",
          }),
        /managed-failed-post-build-gc[\s\S]*fake go: build failed as directed/,
      );
      assert.notEqual(
        fs
          .readFileSync(
            path.join(
              failedRoot,
              "node_modules",
              ".cache",
              "ttsc",
              "go-build",
              ".ttsc-gc",
            ),
            "utf8",
          )
          .trim(),
        failedMarkerValue,
        "failed managed cold builds must enforce post-build GC",
      );


    } catch (error) {
      failures.push(new Error("managed failure maintenance", { cause: error }));
    } finally {
      delete process.env.FAKE_GO_BUILD_EXIT_CODE;
    }

    try {
      const linkedRoot = path.join(root, "linked-plugin-root");
      fs.mkdirSync(linkedRoot);
      fs.writeFileSync(
        path.join(linkedRoot, "pnpm-workspace.yaml"),
        "packages: []\n",
      );
      const linkedRootParent = path.join(
        linkedRoot,
        "node_modules",
        ".cache",
        "ttsc",
      );
      const outsideRoot = path.join(root, "outside-plugin-root");
      const outsideRootSentinel = path.join(outsideRoot, "keep.txt");
      fs.mkdirSync(linkedRootParent, { recursive: true });
      fs.mkdirSync(outsideRoot, { recursive: true });
      fs.writeFileSync(outsideRootSentinel, "keep\n", "utf8");
      writePluginSource(linkedRoot);
      fs.symlinkSync(
        outsideRoot,
        path.join(linkedRootParent, "plugins"),
        process.platform === "win32" ? "junction" : "dir",
      );
      assert.throws(
        () =>
          buildSourcePlugin({
            baseDir: linkedRoot,
            overlayDirs: [],
            pluginName: "linked-plugin-root",
            source: linkedRoot,
            quiet: true,
            ttscVersion: "1.0.0",
            tsgoVersion: "7.0.0-dev",
          }),
        /unsafe plugin cache root/,
      );
      assert.equal(fs.readFileSync(outsideRootSentinel, "utf8"), "keep\n");

    } catch (error) {
      failures.push(new Error("linked cache root", { cause: error }));
    }

    try {
      const linkedEntryRoot = path.join(root, "linked-plugin-entry");
      fs.mkdirSync(linkedEntryRoot);
      fs.writeFileSync(
        path.join(linkedEntryRoot, "pnpm-workspace.yaml"),
        "packages: []\n",
      );
      fs.mkdirSync(path.join(linkedEntryRoot, "node_modules"), {
        recursive: true,
      });
      writePluginSource(linkedEntryRoot);
      const linkedEntryCache = path.join(
        linkedEntryRoot,
        "node_modules",
        ".cache",
        "ttsc",
        "plugins",
      );
      fs.mkdirSync(linkedEntryCache, { recursive: true });
      const linkedEntryKey = computeCacheKey({
        dir: linkedEntryRoot,
        entry: ".",
        env: process.env,
        goBinary: fakeGo,
        overlayDirs: [],
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
      const outsideEntry = path.join(root, "outside-plugin-entry");
      const outsideEntrySentinel = path.join(outsideEntry, "keep.txt");
      fs.mkdirSync(outsideEntry, { recursive: true });
      fs.writeFileSync(outsideEntrySentinel, "keep\n", "utf8");
      fs.symlinkSync(
        outsideEntry,
        path.join(linkedEntryCache, linkedEntryKey),
        process.platform === "win32" ? "junction" : "dir",
      );
      assert.throws(
        () =>
          buildSourcePlugin({
            baseDir: linkedEntryRoot,
            overlayDirs: [],
            pluginName: "linked-plugin-entry",
            source: linkedEntryRoot,
            quiet: true,
            ttscVersion: "1.0.0",
            tsgoVersion: "7.0.0-dev",
          }),
        /unsafe plugin cache entry/,
      );
      assert.equal(fs.readFileSync(outsideEntrySentinel, "utf8"), "keep\n");
    } catch (error) {
      failures.push(new Error("linked cache entry", { cause: error }));
    }

    for (const protocol of ["legacy", "v2", "v3"] as const) {
      try {
        const linkedLockRoot = path.join(root, `linked-${protocol}-lock`);
        fs.mkdirSync(linkedLockRoot);
        fs.writeFileSync(
          path.join(linkedLockRoot, "pnpm-workspace.yaml"),
          "packages: []\n",
        );
        fs.mkdirSync(path.join(linkedLockRoot, "node_modules"), {
          recursive: true,
        });
        writePluginSource(linkedLockRoot);
        const linkedLockCache = path.join(
          linkedLockRoot,
          "node_modules",
          ".cache",
          "ttsc",
          "plugins",
        );
        fs.mkdirSync(linkedLockCache, { recursive: true });
        const linkedLockKey = computeCacheKey({
          dir: linkedLockRoot,
          entry: ".",
          env: process.env,
          goBinary: fakeGo,
          overlayDirs: [],
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
        const outsideLock = path.join(root, `outside-${protocol}-lock`);
        fs.mkdirSync(outsideLock, { recursive: true });
        fs.writeFileSync(path.join(outsideLock, "keep.txt"), "keep\n", "utf8");
        if (protocol !== "legacy") {
          fs.mkdirSync(path.join(outsideLock, "retired"));
          fs.writeFileSync(
            path.join(outsideLock, `protocol-${protocol}`),
            `ttsc-plugin-build-lock-${protocol}\n`,
            "utf8",
          );
        } else {
          const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
          fs.utimesSync(outsideLock, old, old);
        }
        const externalEntries = fs.readdirSync(outsideLock).sort();
        fs.symlinkSync(
          outsideLock,
          `${path.join(linkedLockCache, linkedLockKey)}.lock${protocol === "legacy" ? "" : `.${protocol}`}`,
          process.platform === "win32" ? "junction" : "dir",
        );

        const build = () =>
          buildSourcePlugin({
            baseDir: linkedLockRoot,
            overlayDirs: [],
            pluginName: `linked-${protocol}-lock`,
            source: linkedLockRoot,
            quiet: true,
            ttscVersion: "1.0.0",
            tsgoVersion: "7.0.0-dev",
          });
        if (protocol === "v2") {
          const binary = build();
          assert.equal(fs.existsSync(binary), true);
        } else {
          assert.throws(build);
        }
        assert.deepEqual(
          fs.readdirSync(outsideLock).sort(),
          externalEntries,
          `${protocol} lock coordination escaped through a junction`,
        );
        if (protocol !== "legacy") {
          assert.deepEqual(fs.readdirSync(path.join(outsideLock, "retired")), []);
        }
      } catch (error) {
        failures.push(new Error(`linked ${protocol} lock`, { cause: error }));
      }
    }
    if (failures.length !== 0)
      throw new AggregateError(failures, "Go build cache observations failed");
  } finally {
    if (previousGo === undefined) delete process.env.TTSC_GO_BINARY;
    else process.env.TTSC_GO_BINARY = previousGo;
    if (previousGoCache === undefined) delete process.env.GOCACHE;
    else process.env.GOCACHE = previousGoCache;
    if (previousTtscGoCache === undefined) delete process.env.TTSC_GO_CACHE_DIR;
    else process.env.TTSC_GO_CACHE_DIR = previousTtscGoCache;
    if (previousCapture === undefined)
      delete process.env.FAKE_GO_CAPTURE_ENV_FILE;
    else process.env.FAKE_GO_CAPTURE_ENV_FILE = previousCapture;
    if (previousObjectCount === undefined)
      delete process.env.FAKE_GO_BUILD_CACHE_OBJECT_COUNT;
    else process.env.FAKE_GO_BUILD_CACHE_OBJECT_COUNT = previousObjectCount;
    if (previousMarkerValue === undefined)
      delete process.env.FAKE_GO_BUILD_CACHE_MARKER_VALUE;
    else process.env.FAKE_GO_BUILD_CACHE_MARKER_VALUE = previousMarkerValue;
    if (previousExitCode === undefined)
      delete process.env.FAKE_GO_BUILD_EXIT_CODE;
    else process.env.FAKE_GO_BUILD_EXIT_CODE = previousExitCode;
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

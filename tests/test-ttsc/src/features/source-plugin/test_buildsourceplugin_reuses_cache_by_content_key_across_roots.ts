import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin reuses the cache by content key across roots.
 *
 * Byte-identical plugin trees under different project roots must select the
 * same binary pathname under one explicit `TTSC_CACHE_DIR`. These assertions
 * verify identity/layout and the invocation log independently requires exactly
 * one payload build across both calls.
 *
 * 1. Point `TTSC_CACHE_DIR` at one isolated cache directory.
 * 2. Build two identical source trees from two different project roots.
 * 3. Assert both builds return the same cached binary under that directory.
 * @evidence contracts/testing.md#behavioral-verification Two byte-identical plugin modules under different base roots must return the same binary pathname beneath the explicitly selected TTSC_CACHE_DIR/plugins population.
 * @evidence contracts/testing.md#independent-expectations The fixture writes the same literal module and source bytes to both roots and names one explicit shared cache. Equal returned paths and containment define identity/layout expectations independently of random scratch paths.
 * @evidence contracts/testing.md#distinguishing-cases Different roots with equal content cover path-independent key identity and explicit cache selection. A literal one-build count before and after the second call plus artifact bytes distinguish reuse from redundant compilation; changed-content invalidation is owned elsewhere.
 * @evidence contracts/testing.md#execution-ownership The exported entry currently invokes shipped buildSourcePlugin twice through a scripted Go executable; its assertions cover returned identity/layout, one fixture build and artifact bytes, rather than real Go compiler behavior.
 * @evidence contracts/e2e.md#necessary-boundary The fake executable and two builder calls do not establish a unique native compiler connection. Returned-key/layout semantics are a source-unit transfer candidate; the invocation log owns exactly one fixture build and proves the builder-to-cache handoff without claiming native Go compilation.
 * @evidence contracts/e2e.md#shared-execution Both calls share one fake tool and explicit cache while distinct fixture roots preserve the path-independence premise. Build population must stay one across both calls, so equal paths alone cannot satisfy the reuse oracle.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private equal-content roots and one shared cache isolate identity comparison, and TTSC_GO_BINARY, all three cache overrides and the invocation-log hook are restored in finally. The source bytes remain unchanged across calls; mutation invalidation is not asserted here.
 * @evidence contracts/e2e.md#preserved-coverage Both original equal-path and explicit-cache containment assertions remain. Independent before/after build counts and literal artifact bytes strengthen these original assertions; real Go object reuse is owned by the materializations case.
 */
export const test_buildsourceplugin_reuses_cache_by_content_key_across_roots =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const cacheDir = path.join(root, "shared-cache");
    const first = path.join(root, "project-a", "plugin");
    const second = path.join(root, "project-b", "plugin");
    writePluginSource(first);
    writePluginSource(second);

    const fakeGo = createFakeGoBinary(root);
    const saved = {
      go: process.env.TTSC_GO_BINARY,
      cache: process.env.TTSC_CACHE_DIR,
      goCache: process.env.TTSC_GO_CACHE_DIR,
      gocache: process.env.GOCACHE,
      invocationLog: process.env.FAKE_GO_INVOCATION_LOG,
    };
    const invocationLog = path.join(root, "go-invocations.log");
    process.env.FAKE_GO_INVOCATION_LOG = invocationLog;
    process.env.TTSC_GO_BINARY = fakeGo;
    process.env.TTSC_CACHE_DIR = cacheDir;
    // Isolate the Go cache overrides so the shared TTSC_CACHE_DIR alone decides
    // the resolved paths, matching the sibling default-cache test.
    delete process.env.TTSC_GO_CACHE_DIR;
    delete process.env.GOCACHE;
    try {
      const firstBinary = buildSourcePlugin({
        baseDir: path.dirname(first),
        overlayDirs: [],
        pluginName: "shared-cache",
        source: first,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
      assert.equal(fs.readFileSync(invocationLog, "utf8").split(/\r?\n/).filter((line) => line.startsWith("build ")).length, 1);
      const secondBinary = buildSourcePlugin({
        baseDir: path.dirname(second),
        overlayDirs: [],
        pluginName: "shared-cache",
        source: second,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      assert.equal(fs.readFileSync(invocationLog, "utf8").split(/\r?\n/).filter((line) => line.startsWith("build ")).length, 1);
      assert.equal(fs.readFileSync(secondBinary, "utf8"), "fake plugin binary\n");
      assert.equal(firstBinary, secondBinary);
      assert.equal(
        firstBinary.startsWith(path.join(cacheDir, "plugins")),
        true,
        firstBinary,
      );
    } finally {
      restore("TTSC_GO_BINARY", saved.go);
      restore("TTSC_CACHE_DIR", saved.cache);
      restore("TTSC_GO_CACHE_DIR", saved.goCache);
      restore("GOCACHE", saved.gocache);
      restore("FAKE_GO_INVOCATION_LOG", saved.invocationLog);
    }
  };

function restore(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

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

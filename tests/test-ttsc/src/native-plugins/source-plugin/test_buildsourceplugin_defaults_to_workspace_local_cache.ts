import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin defaults to the workspace-local cache.
 *
 * With no explicit `cacheDir` or `TTSC_CACHE_DIR`, ttsc stores
 * content-addressed binaries under the workspace's
 * `node_modules/.cache/ttsc/plugins` — never a machine-global user cache — so
 * `rm -rf node_modules` reclaims everything and a long-lived toolchain never
 * accumulates plugin builds outside the project.
 *
 * 1. Write a project-root source plugin with a sibling `node_modules`.
 * 2. Build it through the fake Go toolchain with no cache override.
 * 3. Assert the binary lands under `<root>/node_modules/.cache/ttsc/plugins`.
 *
 * @evidence contracts/testing.md#behavioral-verification buildSourcePlugin returns an existing binary below the project node_modules/.cache/ttsc/plugins without overrides.
 * @evidence contracts/testing.md#independent-expectations The default workspace-local cache contract and an intentionally present sibling node_modules establish the expected root.
 * @evidence contracts/testing.md#distinguishing-cases No explicit cacheDir, TTSC_CACHE_DIR, TTSC_GO_CACHE_DIR or GOCACHE is active; explicit cache cases own override behavior.
 * @evidence contracts/testing.md#execution-ownership The exported test_buildsourceplugin_defaults_to_workspace_local_cache entry is discovered by TestExecutor from source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary buildSourcePlugin passes actual executable arguments, cwd, environment and copied workspace inputs through a child process before publication. The fake Go script can fail or record those inputs independently; it proves build orchestration at this process boundary and does not certify native Go compilation.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Calls that change source, cache ownership, environment or tool permissions retain distinct observations because those are the inputs under test. The fake subprocess fixtures avoid unnecessary native compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage buildSourcePlugin returns an existing binary below the project node_modules/.cache/ttsc/plugins without overrides. These assertions stay in test_buildsourceplugin_defaults_to_workspace_local_cache with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_buildsourceplugin_defaults_to_workspace_local_cache = () => {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-source-plugin-"),
  );
  // A sibling `node_modules` makes `root` the resolved workspace root, so the
  // default cache location is deterministic regardless of the temp-dir tree.
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
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
    const binary = buildSourcePlugin({
      baseDir: root,
      overlayDirs: [],
      pluginName: "project-root-source",
      source: root,
      quiet: true,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    assert.equal(
      binary.startsWith(
        path.join(root, "node_modules", ".cache", "ttsc", "plugins"),
      ),
      true,
      binary,
    );
    assert.equal(fs.existsSync(binary), true);
  } finally {
    restore("TTSC_GO_BINARY", saved.go);
    restore("TTSC_CACHE_DIR", saved.cache);
    restore("TTSC_GO_CACHE_DIR", saved.goCache);
    restore("GOCACHE", saved.gocache);
  }
};

function restore(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

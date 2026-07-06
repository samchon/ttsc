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
 */
export const test_buildsourceplugin_defaults_to_workspace_local_cache = () => {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
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

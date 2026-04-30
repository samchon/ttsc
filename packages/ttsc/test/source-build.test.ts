const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  bundledGoPackageRequest,
  computeCacheKey,
  goBinaryName,
  pluginCacheCleanupTargets,
  resolveDefaultPluginCacheRoot,
  resolveGoCompiler,
  resolvePluginCacheRoot,
  sourceBuildWorkspaceReplacements,
} = require("../src/source-build.ts");

function withTempSourceDir(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-cache-key-"));
  for (const [name, contents] of Object.entries(files)) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
  }
  return root;
}

test("computeCacheKey is stable across calls for identical inputs", () => {
  const dir = withTempSourceDir({
    "go.mod": "module example\n\ngo 1.26\n",
    "main.go": "package main\nfunc main() {}\n",
  });
  const inputs = { dir, entry: ".", ttscVersion: "1.0.0", tsgoVersion: "7.0.0-dev" };
  assert.equal(computeCacheKey(inputs), computeCacheKey(inputs));
});

test("computeCacheKey changes when ttscVersion changes", () => {
  const dir = withTempSourceDir({
    "go.mod": "module example\n\ngo 1.26\n",
    "main.go": "package main\nfunc main() {}\n",
  });
  const a = computeCacheKey({ dir, entry: ".", ttscVersion: "1.0.0", tsgoVersion: "7.0.0-dev" });
  const b = computeCacheKey({ dir, entry: ".", ttscVersion: "1.0.1", tsgoVersion: "7.0.0-dev" });
  assert.notEqual(a, b);
});

test("computeCacheKey changes when tsgoVersion changes", () => {
  const dir = withTempSourceDir({
    "go.mod": "module example\n\ngo 1.26\n",
    "main.go": "package main\nfunc main() {}\n",
  });
  const a = computeCacheKey({ dir, entry: ".", ttscVersion: "1.0.0", tsgoVersion: "7.0.0-dev.A" });
  const b = computeCacheKey({ dir, entry: ".", ttscVersion: "1.0.0", tsgoVersion: "7.0.0-dev.B" });
  assert.notEqual(a, b);
});

test("computeCacheKey changes when entry changes", () => {
  const dir = withTempSourceDir({
    "go.mod": "module example\n\ngo 1.26\n",
    "main.go": "package main\nfunc main() {}\n",
    "cmd/foo/main.go": "package main\nfunc main() {}\n",
  });
  const a = computeCacheKey({ dir, entry: ".", ttscVersion: "1.0.0", tsgoVersion: "x" });
  const b = computeCacheKey({ dir, entry: "./cmd/foo", ttscVersion: "1.0.0", tsgoVersion: "x" });
  assert.notEqual(a, b);
});

test("computeCacheKey changes when source content changes", () => {
  const dir = withTempSourceDir({
    "go.mod": "module example\n\ngo 1.26\n",
    "main.go": "package main\nfunc main() {}\n",
  });
  const before = computeCacheKey({ dir, entry: ".", ttscVersion: "1.0.0", tsgoVersion: "x" });
  fs.writeFileSync(
    path.join(dir, "main.go"),
    "package main\nfunc main() { _ = 1 }\n",
  );
  const after = computeCacheKey({ dir, entry: ".", ttscVersion: "1.0.0", tsgoVersion: "x" });
  assert.notEqual(before, after);
});

test("computeCacheKey ignores non-Go files (e.g. README.md)", () => {
  const dir = withTempSourceDir({
    "go.mod": "module example\n\ngo 1.26\n",
    "main.go": "package main\nfunc main() {}\n",
  });
  const before = computeCacheKey({ dir, entry: ".", ttscVersion: "1.0.0", tsgoVersion: "x" });
  fs.writeFileSync(path.join(dir, "README.md"), "documentation\n");
  const after = computeCacheKey({ dir, entry: ".", ttscVersion: "1.0.0", tsgoVersion: "x" });
  assert.equal(before, after);
});

test("resolveGoCompiler prefers TTSC_GO_BINARY override", () => {
  const resolved = resolveGoCompiler({
    env: { TTSC_GO_BINARY: "/tmp/custom-go" },
    localGoLookup: () => "/tmp/local-go",
    resolver: () => {
      throw new Error("resolver should not be called when TTSC_GO_BINARY is set");
    },
  });
  assert.equal(resolved, "/tmp/custom-go");
});

test("resolveGoCompiler uses bundled platform package before PATH fallback", () => {
  const resolved = resolveGoCompiler({
    arch: "x64",
    env: {},
    localGoLookup: () => null,
    platform: "linux",
    resolver: (request) => {
      assert.equal(request, "@ttsc/linux-x64/bin/go/bin/go");
      return "/node_modules/@ttsc/linux-x64/bin/go/bin/go";
    },
  });
  assert.equal(resolved, "/node_modules/@ttsc/linux-x64/bin/go/bin/go");
});

test("resolveGoCompiler falls back to package-local bundled Go before PATH", () => {
  const resolved = resolveGoCompiler({
    env: {},
    localGoLookup: () => "/workspace/packages/ttsc/native/go/bin/go",
    resolver: () => {
      throw new Error("platform package missing");
    },
  });
  assert.equal(resolved, "/workspace/packages/ttsc/native/go/bin/go");
});

test("resolveGoCompiler keeps go on PATH as the last development fallback", () => {
  const resolved = resolveGoCompiler({
    env: {},
    localGoLookup: () => null,
    resolver: () => {
      throw new Error("platform package missing");
    },
  });
  assert.equal(resolved, "go");
});

test("bundled Go package request follows platform package layout", () => {
  assert.equal(goBinaryName({ platform: "win32" }), "go.exe");
  assert.equal(goBinaryName({ platform: "linux" }), "go");
  assert.equal(
    bundledGoPackageRequest({ platform: "darwin", arch: "arm64" }),
    "@ttsc/darwin-arm64/bin/go/bin/go",
  );
  assert.equal(
    bundledGoPackageRequest({ platform: "win32", arch: "x64" }),
    "@ttsc/win32-x64/bin/go/bin/go.exe",
  );
});

test("sourceBuildWorkspaceReplacements pins the ttsc module for source plugins", () => {
  const ttscRoot = withTempSourceDir({
    "go.mod": "module github.com/samchon/ttsc/packages/ttsc\n\ngo 1.26\n",
  });
  const otherRoot = withTempSourceDir({
    "go.mod": "module example.com/other\n\ngo 1.26\n",
  });
  assert.deepEqual(sourceBuildWorkspaceReplacements([otherRoot, ttscRoot]), [
    `replace github.com/samchon/ttsc/packages/ttsc v0.0.0 => ${ttscRoot.replace(/\\/g, "/")}`,
  ]);
});

test("resolvePluginCacheRoot prefers project node_modules cache", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-local-cache-"));
  fs.mkdirSync(path.join(root, "node_modules"));
  assert.equal(
    resolvePluginCacheRoot(root),
    path.join(root, "node_modules", ".ttsc", "plugins"),
  );
});

test("resolvePluginCacheRoot falls back to project .ttsc without node_modules", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-local-cache-"));
  assert.equal(resolvePluginCacheRoot(root), path.join(root, ".ttsc", "plugins"));
});

test("resolveDefaultPluginCacheRoot ignores TTSC_CACHE_DIR for local clean paths", () => {
  const previous = process.env.TTSC_CACHE_DIR;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-local-cache-"));
  fs.mkdirSync(path.join(root, "node_modules"));
  try {
    process.env.TTSC_CACHE_DIR = path.join(root, "override");
    assert.equal(
      resolveDefaultPluginCacheRoot(root),
      path.join(root, "node_modules", ".ttsc", "plugins"),
    );
  } finally {
    if (previous === undefined) {
      delete process.env.TTSC_CACHE_DIR;
    } else {
      process.env.TTSC_CACHE_DIR = previous;
    }
  }
});

test("resolvePluginCacheRoot honors TTSC_CACHE_DIR as an explicit test override", () => {
  const previous = process.env.TTSC_CACHE_DIR;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-local-cache-"));
  const override = path.join(root, "override");
  try {
    process.env.TTSC_CACHE_DIR = override;
    assert.equal(resolvePluginCacheRoot(root), path.join(override, "plugins"));
  } finally {
    if (previous === undefined) {
      delete process.env.TTSC_CACHE_DIR;
    } else {
      process.env.TTSC_CACHE_DIR = previous;
    }
  }
});

test("pluginCacheCleanupTargets deletes both local roots and explicit override", () => {
  const previous = process.env.TTSC_CACHE_DIR;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-local-cache-"));
  const override = path.join(root, "override");
  try {
    process.env.TTSC_CACHE_DIR = override;
    assert.deepEqual(pluginCacheCleanupTargets(root), [
      path.join(root, "node_modules", ".ttsc"),
      path.join(root, ".ttsc"),
      path.join(override, "plugins"),
    ]);
  } finally {
    if (previous === undefined) {
      delete process.env.TTSC_CACHE_DIR;
    } else {
      process.env.TTSC_CACHE_DIR = previous;
    }
  }
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { computeCacheKey } = require("../src/source-build.ts");

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

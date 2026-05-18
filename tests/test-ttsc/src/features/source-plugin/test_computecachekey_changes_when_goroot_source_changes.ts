import {
  assert,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies computeCacheKey changes when GOROOT source changes.
 *
 * The shared cache key uses a pathless GOROOT content fingerprint. A patched
 * standard-library tree can change the binary that `go build` emits even when
 * the Go executable and version text stay the same, so the key must track that
 * source content.
 *
 * 1. Create one source plugin and a fake Go executable.
 * 2. Point effective `GOROOT` at two toolchain roots with different stdlib text.
 * 3. Assert the cache keys differ.
 */
export const test_computecachekey_changes_when_goroot_source_changes = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
  const plugin = path.join(root, "plugin");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
  const go = createFakeGoBinary(root);
  const goRootA = path.join(root, "go-root-a");
  const goRootB = path.join(root, "go-root-b");
  writeGoRoot(goRootA, "alpha");
  writeGoRoot(goRootB, "bravo");

  const previous = process.env.FAKE_GO_ENV_GOROOT;
  try {
    process.env.FAKE_GO_ENV_GOROOT = goRootA;
    const first = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: go,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    process.env.FAKE_GO_ENV_GOROOT = goRootB;
    const second = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: go,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.notEqual(first, second);
  } finally {
    if (previous === undefined) delete process.env.FAKE_GO_ENV_GOROOT;
    else process.env.FAKE_GO_ENV_GOROOT = previous;
  }
};

function writeGoRoot(root: string, marker: string): void {
  fs.mkdirSync(path.join(root, "src", "fmt"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "runtime"), { recursive: true });
  fs.mkdirSync(path.join(root, "pkg", "tool", "linux_amd64"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(root, "VERSION"), "go1.26.0\n", "utf8");
  fs.writeFileSync(path.join(root, "go.env"), "GOTOOLCHAIN=auto\n", "utf8");
  fs.writeFileSync(
    path.join(root, "src", "fmt", "print.go"),
    `package fmt\nconst marker = ${JSON.stringify(marker)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "src", "runtime", "runtime.go"),
    "package runtime\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "pkg", "tool", "linux_amd64", "compile"),
    "compile\n",
    "utf8",
  );
}

import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies computeCacheKey changes when GOROOT source changes in place.
 *
 * Long-lived programmatic hosts can call `prepare()` or `compile()` more than
 * once in one Node process. If a test or installer patches the effective GOROOT
 * between calls, the pathless toolchain fingerprint must be recomputed from
 * content rather than held in a process-global cache.
 *
 * 1. Create one source plugin, one fake Go executable, and one toolchain root.
 * 2. Compute a cache key, then edit a standard-library source file in place.
 * 3. Assert the next cache key differs.
 */
export const test_computecachekey_changes_when_goroot_source_changes_in_place =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const plugin = path.join(root, "plugin");
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
    const go = createFakeGoBinary(root);
    const goRoot = path.join(root, "go-root");
    const sourceFile = writeGoRoot(goRoot, "alpha");

    const previous = process.env.FAKE_GO_ENV_GOROOT;
    try {
      process.env.FAKE_GO_ENV_GOROOT = goRoot;
      const first = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      fs.writeFileSync(
        sourceFile,
        'package fmt\nconst marker = "bravo"\n',
        "utf8",
      );
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

function writeGoRoot(root: string, marker: string): string {
  fs.mkdirSync(path.join(root, "src", "fmt"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "runtime"), { recursive: true });
  fs.mkdirSync(path.join(root, "pkg", "tool", "linux_amd64"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(root, "VERSION"), "go1.26.0\n", "utf8");
  fs.writeFileSync(path.join(root, "go.env"), "GOTOOLCHAIN=auto\n", "utf8");
  const sourceFile = path.join(root, "src", "fmt", "print.go");
  fs.writeFileSync(
    sourceFile,
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
  return sourceFile;
}

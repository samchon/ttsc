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
 * Verifies computeCacheKey ignores GOROOT install path when content matches.
 *
 * Pnpm can expose the same bundled Go SDK through different virtual-store
 * paths. The GOROOT contribution to the shared plugin cache key must follow
 * build-relevant toolchain content, not the absolute install directory.
 *
 * 1. Create one source plugin and a fake Go executable.
 * 2. Point effective `GOROOT` at two identical toolchain roots in different paths.
 * 3. Assert the cache keys match.
 */
export const test_computecachekey_ignores_goroot_install_path_when_content_matches =
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
    const goRootA = path.join(root, "a", "go");
    const goRootB = path.join(root, "b", "go");
    writeGoRoot(goRootA);
    writeGoRoot(goRootB);

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

      assert.equal(first, second);
    } finally {
      if (previous === undefined) delete process.env.FAKE_GO_ENV_GOROOT;
      else process.env.FAKE_GO_ENV_GOROOT = previous;
    }
  };

function writeGoRoot(root: string): void {
  fs.mkdirSync(path.join(root, "src", "fmt"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "runtime"), { recursive: true });
  fs.mkdirSync(path.join(root, "pkg", "tool", "linux_amd64"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(root, "VERSION"), "go1.26.0\n", "utf8");
  fs.writeFileSync(path.join(root, "go.env"), "GOTOOLCHAIN=auto\n", "utf8");
  fs.writeFileSync(
    path.join(root, "src", "fmt", "print.go"),
    'package fmt\nconst marker = "same"\n',
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

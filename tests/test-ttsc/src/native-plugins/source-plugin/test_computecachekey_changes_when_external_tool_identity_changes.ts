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
 * Verifies computeCacheKey changes when external tool identity changes.
 *
 * Cgo-capable builds can resolve `CC`, `CXX`, `AR`, and `PKG_CONFIG` through
 * PATH even when Go's effective env value is only a command name like `gcc`.
 * The cache key must include the resolved tool content, or two shells with the
 * same `CC` value but different PATH entries can share an incompatible binary.
 *
 * 1. Create one source plugin and two same-named fake C compiler binaries.
 * 2. Compute a cache key with PATH resolving the first compiler.
 * 3. Point PATH at the second compiler and assert the key changes.
 */
export const test_computecachekey_changes_when_external_tool_identity_changes =
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
    const toolName = process.platform === "win32" ? "mycc.exe" : "mycc";
    const firstToolDir = writeTool(root, "first", toolName, "alpha");
    const secondToolDir = writeTool(root, "second", toolName, "bravo");

    const previousCc = process.env.FAKE_GO_ENV_CC;
    const previousPath = process.env.PATH;
    try {
      process.env.FAKE_GO_ENV_CC = toolName;
      process.env.PATH = [firstToolDir, previousPath ?? ""]
        .filter((part) => part !== "")
        .join(path.delimiter);
      const first = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      process.env.PATH = [secondToolDir, previousPath ?? ""]
        .filter((part) => part !== "")
        .join(path.delimiter);
      const second = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      assert.notEqual(first, second);
    } finally {
      if (previousCc === undefined) delete process.env.FAKE_GO_ENV_CC;
      else process.env.FAKE_GO_ENV_CC = previousCc;
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
    }
  };

function writeTool(
  root: string,
  name: string,
  toolName: string,
  content: string,
): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, toolName), content, "utf8");
  return dir;
}

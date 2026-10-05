import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { computeCacheKey } from "../../../../../packages/ttsc/src/plugin/internal/source/computeCacheKey";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies GOROOT key identity follows SDK content and unresolved root
 * identity.
 *
 * Explicit build environment values enter the same SDK normalization used for
 * effective Go metadata. Testing that content identity does not require a fake
 * compiler merely to return an already authored GOROOT path.
 *
 * 1. Author one plugin and three SDK roots with equal and contrasting bytes.
 * 2. Require equal-content roots to share a key and distinct-content roots not to.
 * 3. Edit one SDK in place and require its key to change in the same process.
 * 4. Require two unresolved roots to remain distinct and repeated unchanged inputs
 *    to retain the same key.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls computeCacheKey source with explicit env.GOROOT and no goBinary, preserving the four previous root identity assertions: unresolved path separation, cross-root changed content, same-root edited content and path-independent equal content. Repeated unchanged input adds a positive stability control.
 * @evidence contracts/testing.md#independent-expectations Independently authored VERSION, go.env, fmt/runtime and compiler-tool bytes establish equal SDKs; alpha versus bravo and a same-path rewrite establish changed content. Distinct nonexistent paths cannot establish one known content identity. Equality expectations follow those input relations rather than a production-computed expected digest.
 * @evidence contracts/testing.md#distinguishing-cases Owns existing equal-content relocation, different-content relocation, same-root content mutation, missing-root separation and unchanged-input stability. Actual effective go env transport remains in test_computecachekey_changes_when_effective_go_env_changes; test_computecachekey_memoizes_unchanged_goroot_content_reads retains real build permission-repair and cache-reuse integration.
 * @evidence contracts/testing.md#execution-ownership The named exported source unit is discovered and selected under test-ttsc/features/source-plugin. Explicit env values and no goBinary reach the SDK identity owner in process; the authored plugin has no replace directives, so no Go metadata process, native build or product host is needed. Finally removes all call-owned files without changing ambient environment.
 */
export function test_goroot_key_identity_preserves_content_and_unresolved_roots(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-goroot-key-unit-")),
  );
  try {
    const fixture = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "goroot_key_identity_preserves_content_and_unresolved_roots",
    );
    TestProject.copyDirectory(path.join(fixture, "inputs-1"), root);
    for (const relative of [
      "plugin/main.go",
      "a/go/src/fmt/print.go",
      "a/go/src/runtime/runtime.go",
      "b/go/src/fmt/print.go",
      "b/go/src/runtime/runtime.go",
      "c/go/src/fmt/print.go",
      "c/go/src/runtime/runtime.go",
    ])
      fs.renameSync(
        path.join(root, `${relative}.txt`),
        path.join(root, relative),
      );
    const plugin = path.join(root, "plugin");
    assert.equal(
      fs.readFileSync(path.join(plugin, "go.mod"), "utf8"),
      "module example.com/plugin\n\ngo 1.26\n",
    );
    assert.equal(
      fs.readFileSync(path.join(plugin, "main.go"), "utf8"),
      "package main\n",
    );
    const sdkA = path.join(root, "a", "go");
    const sdkB = path.join(root, "b", "go");
    const sdkC = path.join(root, "c", "go");
    for (const [sdk, marker] of [
      [sdkA, "alpha"],
      [sdkB, "alpha"],
      [sdkC, "bravo"],
    ] as const) {
      fs.mkdirSync(path.join(sdk, "src", "fmt"), { recursive: true });
      fs.mkdirSync(path.join(sdk, "src", "runtime"), { recursive: true });
      fs.mkdirSync(path.join(sdk, "pkg", "tool", "linux_amd64"), {
        recursive: true,
      });
      fs.writeFileSync(path.join(sdk, "VERSION"), "go1.26.0\n");
      fs.writeFileSync(path.join(sdk, "go.env"), "GOTOOLCHAIN=auto\n");
      assert.equal(
        fs.readFileSync(path.join(sdk, "src", "fmt", "print.go"), "utf8"),
        `package fmt\nconst marker = ${JSON.stringify(marker)}\n`,
      );
      assert.equal(
        fs.readFileSync(path.join(sdk, "src", "runtime", "runtime.go"), "utf8"),
        "package runtime\n",
      );
      fs.writeFileSync(
        path.join(sdk, "pkg", "tool", "linux_amd64", "compile"),
        "compile\n",
      );
    }
    const key = (goroot: string): string =>
      computeCacheKey({
        dir: plugin,
        entry: ".",
        env: { GOROOT: goroot },
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
    const original = key(sdkA);
    assert.equal(
      key(sdkB),
      original,
      "equal content must ignore installation path",
    );
    assert.notEqual(key(sdkC), original, "different SDK bytes must invalidate");
    assert.equal(
      key(sdkA),
      original,
      "unchanged SDK identity must remain stable",
    );
    fs.copyFileSync(
      path.join(fixture, "inputs-2", "a", "go", "src", "fmt", "print.go.txt"),
      path.join(sdkA, "src", "fmt", "print.go"),
    );
    assert.equal(
      fs.readFileSync(path.join(sdkA, "src", "fmt", "print.go"), "utf8"),
      'package fmt\nconst marker = "bravo"\n',
    );
    assert.notEqual(
      key(sdkA),
      original,
      "same-process in-place edits must invalidate",
    );
    assert.notEqual(
      key(path.join(root, "missing-a")),
      key(path.join(root, "missing-b")),
      "unresolved roots must not claim equal content identity",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

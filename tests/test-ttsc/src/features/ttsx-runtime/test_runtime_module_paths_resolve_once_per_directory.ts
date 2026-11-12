import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EmitOwnershipIndex } from "../../../../../packages/ttsc/src/compiler/internal/EmitOwnershipIndex";
import { modulePhysicalPath } from "../../../../../packages/ttsc/src/launcher/internal/runtime/modulePhysicalPath";

/**
 * Verifies a served module's physical path is resolved through its directory,
 * and that one resolution answers every build asked about that module.
 *
 * Each load resolved the module's own path several times: once to serve it and
 * once more inside every build's ownership lookup (samchon/ttsc#1852).
 *
 * 1. Resolve modules through a real directory and through a directory link.
 * 2. Resolve a missing module, which keeps its spelling.
 * 3. Ask an ownership index with the resolved path, and with a link spelling that
 *    only a fresh resolution can match.
 *
 * @evidence contracts/testing.md#behavioral-verification The production resolver and ownership index run over a real tree with a native directory link; returned paths and owned outputs are compared directly.
 * @evidence contracts/testing.md#independent-expectations Node's native realpath of each authored file is the expected physical path, and the authored provenance fixes which output each source owns.
 * @evidence contracts/testing.md#distinguishing-cases A physical spelling, a spelling through a directory link, a missing module, and an ownership lookup by physical path versus by link spelling separate a shared directory resolution from a per-module one and a caller-resolved lookup from a resolving one.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls maintained owners over an owned temporary tree; no compiler or product host runs and finally removes the tree.
 */
export function test_runtime_module_paths_resolve_once_per_directory(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-module-paths-")),
  );
  try {
    const source = path.join(root, "package", "src");
    const emit = path.join(root, "emit");
    const linked = path.join(root, "linked");
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(emit);
    const first = path.join(source, "first.ts");
    const second = path.join(source, "second.ts");
    fs.writeFileSync(first, "export const first = 1;\n");
    fs.writeFileSync(second, "export const second = 2;\n");
    fs.symlinkSync(
      path.join(root, "package"),
      linked,
      process.platform === "win32" ? "junction" : "dir",
    );

    assert.equal(modulePhysicalPath(first), fs.realpathSync.native(first));
    assert.equal(modulePhysicalPath(second), fs.realpathSync.native(second));
    const alias = path.join(linked, "src", "second.ts");
    assert.notEqual(alias, second);
    assert.equal(modulePhysicalPath(alias), fs.realpathSync.native(second));
    const missing = path.join(source, "missing.ts");
    assert.equal(modulePhysicalPath(missing), missing);

    for (const name of ["first.js", "second.js"])
      fs.writeFileSync(path.join(emit, name), "compiled");
    const index = new EmitOwnershipIndex({
      emitDir: emit,
      rootDir: source,
      outputs: ["first.js", "second.js"],
      emittedSources: {
        [path.join(emit, "first.js")]: [first],
        [path.join(emit, "second.js")]: [second],
      },
    });
    const owned = fs.realpathSync.native(path.join(emit, "second.js"));
    assert.equal(index.findPhysical(modulePhysicalPath(alias)), owned);
    assert.equal(index.find(alias), owned);
    // A spelling that is not the physical path is not a captured source.
    assert.equal(index.findPhysical(alias), null);
    assert.equal(index.findPhysical(missing), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

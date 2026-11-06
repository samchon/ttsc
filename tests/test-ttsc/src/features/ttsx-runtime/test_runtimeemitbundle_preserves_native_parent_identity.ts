import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EmitOwnershipIndex } from "../../../../../packages/ttsc/src/compiler/internal/EmitOwnershipIndex";
import { RuntimeEmitBundle } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeEmitBundle";

/**
 * Verifies private output coordinates preserve native directory identity.
 * Physical and bundled generations must accept the same actual parent aliases.
 *
 * 1. Compare physical and bundled source ownership through a directory link.
 * 2. Read an owned output through canonical and aliased parents.
 * 3. Distinguish a real case alias from a native case-distinct sibling.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual bundle/index calls must find and read authored output through both parent spellings. An outside native sibling must supply neither bundled bytes nor provenance, while an actual case alias remains usable.
 * @evidence contracts/testing.md#independent-expectations Literal source/output text and native realpath/device/inode establish expected identity independently of the product's relative-path logic or bundle metadata.
 * @evidence contracts/testing.md#distinguishing-cases Physical versus bundled representations, physical versus linked emit roots and provenance, unknown output names, outside parents and observed case alias versus distinct sibling cover containment without guessing OS case policy. A host exposing only one native case behavior exercises that branch; other CI hosts cover their actual behavior.
 * @evidence contracts/testing.md#execution-ownership The named source unit calls maintained storage/ownership owners over owned native scratch. It launches no compiler, installer or real runtime host; finally removes its directory links before the root.
 */
export function test_runtimeemitbundle_preserves_native_parent_identity(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-native-parent-")),
  );
  const links: string[] = [];
  try {
    const source = path.join(root, "source.ts");
    const text = "exports.value = 7;";
    fs.writeFileSync(source, "export const value = 7;");
    for (const bundled of [false, true]) {
      const emit = path.join(root, bundled ? "bundled" : "physical");
      const alias = emit + "-alias";
      fs.mkdirSync(emit);
      if (bundled)
        assert.equal(
          RuntimeEmitBundle.write(emit, [
            ["main.js", Buffer.from(text).toString("base64")],
          ]),
          true,
        );
      else fs.writeFileSync(path.join(emit, "main.js"), text);
      fs.symlinkSync(emit, alias, "junction");
      links.push(alias);
      for (const [emitDir, provenance] of [
        [alias, emit],
        [emit, alias],
      ]) {
        const index = new EmitOwnershipIndex({
          emitDir: emitDir!,
          rootDir: root,
          bundledOutputs: bundled ? true : undefined,
          outputs: ["main.js"],
          emittedSources: {
            [path.join(provenance!, "main.js")]: [source],
          },
        });
        assert.equal(index.find(source), path.join(emit, "main.js"));
        assert.equal(index.readOutput(path.join(alias, "main.js")), text);
        assert.equal(index.readOutput(path.join(emit, "main.js")), text);
      }
      if (bundled) {
        const owner = RuntimeEmitBundle.open(alias)!;
        assert.equal(owner.read(path.join(alias, "missing.js")), null);
        assert.equal(owner.read(path.join(root, "main.js")), null);
      }
    }
    const lower = path.join(root, "emit");
    const upper = path.join(root, "EMIT");
    fs.mkdirSync(lower);
    try {
      fs.mkdirSync(upper);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const a = fs.statSync(lower, { bigint: true });
    const b = fs.statSync(upper, { bigint: true });
    const same = a.dev === b.dev && a.ino === b.ino;
    assert.equal(
      RuntimeEmitBundle.write(lower, [
        ["main.js", Buffer.from(text).toString("base64")],
      ]),
      true,
    );
    const owner = RuntimeEmitBundle.open(lower)!;
    if (!same) fs.writeFileSync(path.join(upper, "main.js"), "outside bytes");
    assert.equal(owner.read(path.join(upper, "main.js")), same ? text : null);
    if (!same)
      assert.throws(
        () =>
          new EmitOwnershipIndex({
            emitDir: lower,
            rootDir: root,
            bundledOutputs: true,
            outputs: ["main.js"],
            emittedSources: { [path.join(upper, "main.js")]: [source] },
          }),
      );
  } finally {
    for (const link of links) fs.unlinkSync(link);
    fs.rmSync(root, { recursive: true });
  }
}

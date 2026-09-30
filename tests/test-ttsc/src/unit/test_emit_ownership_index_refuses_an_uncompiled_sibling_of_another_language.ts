import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { EmitOwnershipIndex } from "../../../../packages/ttsc/src/compiler/internal/EmitOwnershipIndex";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies same-stem language siblings never obtain another source's emit.
 *
 * Actual producer provenance decides ownership even when source maps disappear
 * or disagree. Extension precedence cannot prove which input the producer read.
 *
 * 1. Record JavaScript ownership for each TypeScript/JavaScript language pair.
 * 2. Check both siblings with matching, missing and contradictory source maps.
 * 3. Refuse unavailable or ambiguous producer records instead of guessing.
 */
export function test_emit_ownership_index_refuses_an_uncompiled_sibling_of_another_language(): void {
  const base = fs.realpathSync.native(TestProject.tmpdir("ttsc-ownership-"));
  const root = path.join(base, "root");
  const emit = path.join(base, "emit");
  fs.mkdirSync(root);
  fs.mkdirSync(emit);
  const pairs = [
    ["a.ts", "a.js", "a.js"], ["b.mts", "b.mjs", "b.mjs"],
    ["c.cts", "c.cjs", "c.cjs"], ["d.tsx", "d.jsx", "d.jsx"],
  ];
  const emittedSources: Record<string, string[]> = {};
  for (const [typescript, javascript, output] of pairs) {
    fs.writeFileSync(path.join(root, typescript!), "//\n");
    fs.writeFileSync(path.join(root, javascript!), "//\n");
    fs.writeFileSync(path.join(emit, output!), "//\n");
    emittedSources[path.join(emit, output!)] = [fs.realpathSync.native(path.join(root, javascript!))];
  }
  for (const mapState of ["matching", "missing", "contradictory"]) {
    for (const [typescript, javascript, output] of pairs) {
      const map = path.join(emit, output! + ".map");
      if (mapState === "missing") fs.rmSync(map, { force: true });
      else fs.writeFileSync(map, JSON.stringify({ version: 3, sources: [path.join(root, mapState === "matching" ? javascript! : typescript!)], mappings: "" }));
    }
    const index = new EmitOwnershipIndex({ emitDir: emit, rootDir: root, outputs: pairs.map((pair) => pair[2]!), emittedSources });
    for (const [typescript, javascript, output] of pairs) {
      assert.equal(index.find(path.join(root, typescript!)), null, `${mapState}: ${typescript} was not compiled`);
      assert.equal(index.find(path.join(root, javascript!)), path.join(emit, output!), `${mapState}: ${javascript} owns ${output}`);
    }
  }
  for (const sources of [undefined, [], [path.join(root, "a.ts"), path.join(root, "a.js")]]) {
    const index = new EmitOwnershipIndex({ emitDir: emit, rootDir: root, outputs: ["a.js"], emittedSources: sources === undefined ? undefined : { [path.join(emit, "a.js")]: sources } });
    assert.throws(() => index.find(path.join(root, "a.ts")), /ownership is unavailable/, "a filename and map cannot repair missing producer authority");
  }
}

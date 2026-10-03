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
 *
 * @evidence contracts/testing.md#behavioral-verification Calls EmitOwnershipIndex.find for same-stem TS/JS, MTS/MJS, CTS/CJS and TSX/JSX source pairs against authored producer provenance.
 * @evidence contracts/testing.md#independent-expectations Literal language pairs and captured JavaScript owner paths establish who produced each existing output; independently authored source maps deliberately agree, disappear or contradict this authority.
 * @evidence contracts/testing.md#distinguishing-cases An uncompiled language sibling returns null while the recorded owner receives its output in all three map states; unavailable, empty and conflicting producer records must throw rather than guessing by extension.
 * @evidence contracts/testing.md#execution-ownership Executes EmitOwnershipIndex.find over files written under a private TestProject.tmpdir in one unit process; the producer provenance is authored in the test, so no compiler emission, native producer or product host runs.
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

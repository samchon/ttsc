import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { ViteModuleGraphLike } from "../../../../../packages/unplugin/src/core/vite/ViteModuleGraphLike";
import type { ViteModuleNodeLike } from "../../../../../packages/unplugin/src/core/vite/ViteModuleNodeLike";
import { selectModulesByFile } from "../../../../../packages/unplugin/src/core/vite/selectModulesByFile";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Selects exact host nodes before identity fallback, and observes directory
 * alias changes in the next selection rather than retaining the old target.
 *
 * Real files and two directory links establish shared native targets. Empty and
 * missing exact answers retain every authored node registered for the matching
 * target, without admitting another file or a previous target after the query's
 * link moves. No Vite server or installed consumer runs.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls selectModulesByFile with populated, empty and undefined host lookup answers and an absent lookup capability. Asserts exact-node priority, all matching physical/link nodes, unrelated exclusion, fresh retargeted selection and empty absent-map output; node object identities are preserved.
 * @evidence contracts/testing.md#independent-expectations Native realpath independently establishes the two links' targets before each relevant call. Expected node arrays are authored literals attached to those files; no product identity resolver generates the oracle. The host's populated exact set is authoritative even when fallback would return different nodes.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts populated versus empty/undefined/absent exact lookup, two nodes for one physical key plus a distinct link-key node, unrelated files, a directory alias retargeted between calls and a missing graph map. All owned directory links are removed in finally, with native junctions on Windows and directory links elsewhere.
 * @evidence contracts/testing.md#execution-ownership Unit test: directly calls the owning selector against an authored ViteModuleGraphLike and actual temporary file/link identities. Only native filesystem inputs run; no Vite host, bundler, compiler, helper process or consumer artifact is prepared. It does not certify downstream invalidation/reload transport or native event timing.
 */
export function test_vite_module_selection_keeps_exact_priority_and_fresh_aliases(): void {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-module-selection-"),
  );
  const firstDirectory = path.join(root, "first");
  const secondDirectory = path.join(root, "second");
  fs.mkdirSync(firstDirectory);
  fs.mkdirSync(secondDirectory);
  const firstFile = path.join(firstDirectory, "input.ts");
  const secondFile = path.join(secondDirectory, "input.ts");
  const unrelatedFile = path.join(root, "other.ts");
  for (const file of [firstFile, secondFile, unrelatedFile]) {
    fs.writeFileSync(file, "export {};\n");
  }
  const queryDirectory = path.join(root, "query");
  const siblingDirectory = path.join(root, "sibling");
  const kind = process.platform === "win32" ? "junction" : "dir";
  const query = path.join(queryDirectory, "input.ts");
  const sibling = path.join(siblingDirectory, "input.ts");
  const first = { name: "first" };
  const second = { name: "second" };
  const alias = { name: "alias" };
  const next = { name: "next" };
  const unrelated = { name: "unrelated" };
  const exact = { name: "exact" };
  const exactOther = { name: "exact-other" };
  const map = new Map<string, Set<ViteModuleNodeLike>>([
    [firstFile, new Set([first, second])],
    [sibling, new Set([alias])],
    [secondFile, new Set([next])],
    [unrelatedFile, new Set([unrelated])],
  ]);
  const requested: string[] = [];
  let mode: "populated" | "empty" | "undefined" = "populated";
  const graph: ViteModuleGraphLike = {
    getModulesByFile: (file) => {
      requested.push(file);
      return mode === "populated"
        ? new Set([exact, exactOther])
        : mode === "empty"
          ? new Set()
          : undefined;
    },
    fileToModulesMap: map,
  };
  const expectNodes = (
    actual: ViteModuleNodeLike[],
    expected: ViteModuleNodeLike[],
  ): void => {
    assert.deepEqual(actual, expected);
    for (let i = 0; i < expected.length; i++) {
      assert.equal(
        actual[i],
        expected[i],
        "the host's opaque node is returned unchanged",
      );
    }
  };
  try {
    fs.symlinkSync(firstDirectory, queryDirectory, kind);
    fs.symlinkSync(firstDirectory, siblingDirectory, kind);
    assert.equal(fs.lstatSync(queryDirectory).isSymbolicLink(), true);
    assert.equal(fs.realpathSync.native(query), firstFile);
    assert.equal(fs.realpathSync.native(sibling), firstFile);
    expectNodes(selectModulesByFile(graph, query), [exact, exactOther]);
    assert.deepEqual(requested.splice(0), [
      `${root.split(path.sep).join("/")}/query/input.ts`,
    ]);
    mode = "empty";
    expectNodes(selectModulesByFile(graph, query), [first, second, alias]);
    mode = "undefined";
    expectNodes(selectModulesByFile(graph, query), [first, second, alias]);
    expectNodes(selectModulesByFile({ fileToModulesMap: map }, query), [
      first,
      second,
      alias,
    ]);

    fs.unlinkSync(queryDirectory);
    fs.symlinkSync(secondDirectory, queryDirectory, kind);
    assert.equal(fs.realpathSync.native(query), secondFile);
    assert.equal(fs.realpathSync.native(sibling), firstFile);
    expectNodes(selectModulesByFile(graph, query), [next]);
    expectNodes(selectModulesByFile({}, query), []);
  } finally {
    for (const directory of [queryDirectory, siblingDirectory]) {
      if (fs.existsSync(directory)) fs.unlinkSync(directory);
    }
  }
}

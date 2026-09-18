import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { selectReferencedProject } from "../../../../../packages/unplugin/lib/core/tsconfig/selectReferencedProject.mjs";

/**
 * Verifies a file's default project is selected through a solution config's
 * `references`, the way TypeScript's project service selects it
 * (samchon/ttsc#1397).
 *
 * The create-vite `react-ts` template puts `"files": []` in `tsconfig.json` and
 * the real projects under `references`. Compiling the nearest config produced
 * an empty program, so every module was left untransformed with advice to add
 * an `include` that would break the `tsc -b` graph.
 *
 * Every config the search read besides the selected one is reported as
 * consulted, because editing any of them can re-route the file: a solution's
 * `references`, the `include` of a project searched earlier, or a referenced
 * config that does not exist yet. A reference is spelled the way TypeScript-Go
 * spells it, by its `.json` suffix rather than by what is on disk, so a missing
 * config is consulted under the name it will appear with. What a config selects
 * is remembered by its content, since an edit that keeps its size and lands
 * within the clock tick of the previous write leaves its metadata as it was.
 *
 * 1. Select sources and the Vite config of the create-vite layout, and assert each
 *    reaches its referenced project with every config searched before it as
 *    consulted.
 * 2. Select through a nested solution, a reference cycle, a reference to a missing
 *    directory, and a missing `.json` reference that later appears and is then
 *    rewritten with its size and modification time kept.
 * 3. Assert a config that admits the file itself keeps it despite its
 *    `references`, and a file no project admits keeps the nearest config with
 *    every searched config consulted.
 * 4. Select below a directory one reference includes and excludes, and assert the
 *    reference that includes it wins unless the first lists the file.
 */
export async function test_default_project_follows_solution_references(): Promise<void> {
  const root = fs.realpathSync.native(TestProject.tmpdir("ttsc-solution-"));
  const at = (...segments: string[]) => path.join(root, ...segments);
  const config = (file: string, body: object) =>
    TestProject.writeFiles(root, { [file]: JSON.stringify(body) });
  TestProject.writeFiles(root, {
    "src/App.tsx": "export {};\n",
    "vite.config.ts": "export {};\n",
    "scripts/tool.ts": "export {};\n",
    "packages/lib/src/index.ts": "export {};\n",
    "own/src/main.ts": "export {};\n",
    "cycle/src/main.ts": "export {};\n",
    "split/src/main.ts": "export {};\n",
    "split/src/legacy/old.ts": "export {};\n",
    "split/src/legacy/pinned.ts": "export {};\n",
    "late/src/main.ts": "export {};\n",
  });
  config("tsconfig.json", {
    files: [],
    references: [
      { path: "./tsconfig.app.json" },
      { path: "./tsconfig.node.json" },
      { path: "./missing" },
      { path: "./packages" },
    ],
  });
  config("tsconfig.app.json", { include: ["src"] });
  config("tsconfig.node.json", { include: ["vite.config.ts"] });
  config("packages/tsconfig.json", {
    files: [],
    references: [{ path: "./lib" }],
  });
  config("packages/lib/tsconfig.json", { include: ["src"] });
  config("own/tsconfig.json", {
    include: ["src"],
    references: [{ path: "../tsconfig.app.json" }],
  });
  config("cycle/tsconfig.json", {
    files: [],
    references: [{ path: "./tsconfig.a.json" }],
  });
  config("split/tsconfig.json", {
    files: [],
    references: [
      { path: "./tsconfig.app.json" },
      { path: "./tsconfig.legacy.json" },
    ],
  });
  config("split/tsconfig.app.json", {
    exclude: ["src/legacy"],
    files: ["src/legacy/pinned.ts"],
    include: ["src"],
  });
  config("split/tsconfig.legacy.json", { include: ["src/legacy"] });
  config("cycle/tsconfig.a.json", {
    files: [],
    references: [{ path: "./tsconfig.json" }],
  });
  config("late/tsconfig.json", {
    files: [],
    references: [{ path: "./tsconfig.later.json" }],
  });

  const solution = at("tsconfig.json");
  assert.deepEqual(selectReferencedProject(at("src", "App.tsx"), solution), {
    consulted: [solution],
    tsconfig: at("tsconfig.app.json"),
  });
  assert.deepEqual(
    selectReferencedProject(at("vite.config.ts"), solution),
    {
      consulted: [solution, at("tsconfig.app.json")],
      tsconfig: at("tsconfig.node.json"),
    },
    "a project searched before the selected one is consulted",
  );
  assert.deepEqual(
    selectReferencedProject(at("packages", "lib", "src", "index.ts"), solution),
    {
      consulted: [
        solution,
        at("tsconfig.app.json"),
        at("tsconfig.node.json"),
        at("missing", "tsconfig.json"),
        at("packages", "tsconfig.json"),
      ],
      tsconfig: at("packages", "lib", "tsconfig.json"),
    },
    "a nested solution is followed depth-first",
  );
  assert.deepEqual(
    selectReferencedProject(at("scripts", "tool.ts"), solution),
    {
      consulted: [
        at("tsconfig.app.json"),
        at("tsconfig.node.json"),
        at("missing", "tsconfig.json"),
        at("packages", "tsconfig.json"),
        at("packages", "lib", "tsconfig.json"),
      ],
      tsconfig: solution,
    },
    "a file no project admits keeps the nearest config and consults every other",
  );
  const late = at("late", "tsconfig.json");
  const later = at("late", "tsconfig.later.json");
  const lateFile = at("late", "src", "main.ts");
  assert.deepEqual(
    selectReferencedProject(lateFile, late),
    { consulted: [later], tsconfig: late },
    "a missing .json reference is consulted under its own spelling",
  );
  // A pinned modification time lets the rewrite below restore it exactly.
  const pinned = 1_700_000_000;
  config("late/tsconfig.later.json", { include: ["src"] });
  fs.utimesSync(later, pinned, pinned);
  for (let round = 0; round < 2; ++round) {
    assert.deepEqual(
      selectReferencedProject(lateFile, late),
      { consulted: [late], tsconfig: later },
      "the reference selects the file once it appears",
    );
  }
  config("late/tsconfig.later.json", { include: ["lib"] });
  fs.utimesSync(later, pinned, pinned);
  assert.deepEqual(
    selectReferencedProject(lateFile, late),
    { consulted: [later], tsconfig: late },
    "an edit that keeps the size and modification time still re-routes",
  );
  assert.deepEqual(
    selectReferencedProject(
      at("own", "src", "main.ts"),
      at("own", "tsconfig.json"),
    ),
    { consulted: [], tsconfig: at("own", "tsconfig.json") },
    "a config that admits the file keeps it despite its references",
  );
  assert.deepEqual(
    selectReferencedProject(
      at("cycle", "src", "main.ts"),
      at("cycle", "tsconfig.json"),
    ),
    {
      consulted: [at("cycle", "tsconfig.a.json")],
      tsconfig: at("cycle", "tsconfig.json"),
    },
    "a reference cycle terminates",
  );
  const split = at("split", "tsconfig.json");
  for (const [file, selected, earlier, reason] of [
    [
      "main.ts",
      "tsconfig.app.json",
      [],
      "an included file stays with its project",
    ],
    [
      "legacy/old.ts",
      "tsconfig.legacy.json",
      [at("split", "tsconfig.app.json")],
      "an excluded file belongs to the reference that includes it",
    ],
    [
      "legacy/pinned.ts",
      "tsconfig.app.json",
      [],
      "a `files` entry is taken despite `exclude`",
    ],
  ] as const) {
    assert.deepEqual(
      selectReferencedProject(at("split", "src", ...file.split("/")), split),
      { consulted: [split, ...earlier], tsconfig: at("split", selected) },
      reason,
    );
  }
}

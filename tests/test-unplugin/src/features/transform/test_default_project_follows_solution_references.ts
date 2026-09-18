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
 * 1. Select sources and the Vite config of the create-vite layout, and assert each
 *    reaches its referenced project with the solution as consulted.
 * 2. Select through a nested solution, a reference cycle, and a reference to a
 *    missing config.
 * 3. Assert a config that admits the file itself keeps it despite its
 *    `references`, and a file no project admits keeps the nearest config.
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

  const solution = at("tsconfig.json");
  assert.deepEqual(selectReferencedProject(at("src", "App.tsx"), solution), {
    consulted: [solution],
    tsconfig: at("tsconfig.app.json"),
  });
  assert.deepEqual(selectReferencedProject(at("vite.config.ts"), solution), {
    consulted: [solution],
    tsconfig: at("tsconfig.node.json"),
  });
  assert.deepEqual(
    selectReferencedProject(at("packages", "lib", "src", "index.ts"), solution),
    {
      consulted: [solution, at("packages", "tsconfig.json")],
      tsconfig: at("packages", "lib", "tsconfig.json"),
    },
    "a nested solution is followed depth-first",
  );
  assert.deepEqual(
    selectReferencedProject(at("scripts", "tool.ts"), solution),
    { consulted: [], tsconfig: solution },
    "a file no project admits keeps the nearest config",
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
    { consulted: [], tsconfig: at("cycle", "tsconfig.json") },
    "a reference cycle terminates",
  );
  const split = at("split", "tsconfig.json");
  for (const [file, selected, reason] of [
    ["main.ts", "tsconfig.app.json", "an included file stays with its project"],
    [
      "legacy/old.ts",
      "tsconfig.legacy.json",
      "an excluded file belongs to the reference that includes it",
    ],
    [
      "legacy/pinned.ts",
      "tsconfig.app.json",
      "a `files` entry is taken despite `exclude`",
    ],
  ] as const) {
    assert.deepEqual(
      selectReferencedProject(at("split", "src", ...file.split("/")), split),
      { consulted: [split], tsconfig: at("split", selected) },
      reason,
    );
  }
}

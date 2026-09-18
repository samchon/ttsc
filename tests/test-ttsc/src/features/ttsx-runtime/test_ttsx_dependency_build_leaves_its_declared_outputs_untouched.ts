import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies building a raw-TypeScript dependency through its own tsconfig
 * writes nothing into the dependency's declared output locations.
 *
 * The dependency lane builds the dependency's project into a private
 * generation directory. Its own `declarationDir` and `tsBuildInfoFile` name
 * locations of their own, so the build wrote `.d.ts` files and build
 * information into the dependency's tree, where a published package or a
 * sibling workspace keeps its real outputs (samchon/ttsc#1404). A root the
 * dependency's project does not include goes through a build of its own and
 * must be isolated the same way.
 *
 * 1. Create a workspace `dep` whose tsconfig declares `declaration`,
 *    `declarationDir`, `composite`, and `tsBuildInfoFile`, with one included
 *    file and one outside `include`.
 * 2. Run an app entry that requires both.
 * 3. Assert both values arrive and `dep` holds no file it did not start with.
 */
export const test_ttsx_dependency_build_leaves_its_declared_outputs_untouched =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "dep-outputs", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `declare const require: (id: string) => { value: string };`,
        `console.log(require("../dep/src/inside.ts").value);`,
        `console.log(require("../dep/extra.ts").value);`,
        `export {};`,
        ``,
      ].join("\n"),
      "dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          composite: true,
          declaration: true,
          declarationDir: "types",
          tsBuildInfoFile: "state/dep.tsbuildinfo",
          outDir: "lib",
          rootDir: ".",
          types: [],
        },
        include: ["src"],
      }),
      "dep/src/inside.ts": `export const value: string = "inside";\n`,
      "dep/extra.ts": `export const value: string = "extra";\n`,
    });
    const before = listTree(path.join(root, "dep"));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), ["inside", "extra"]);
    assert.deepEqual(listTree(path.join(root, "dep")), before);
  };

/** Every file below `directory`, as sorted `/` paths. */
function listTree(directory: string): string[] {
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const location = path.join(current, entry.name);
      if (entry.isDirectory()) walk(location);
      else files.push(path.relative(directory, location).split(path.sep).join("/"));
    }
  };
  walk(directory);
  return files.sort();
}

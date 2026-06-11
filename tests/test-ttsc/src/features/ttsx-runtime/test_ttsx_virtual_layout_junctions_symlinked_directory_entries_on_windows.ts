import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx mirrors symlinked directory entries without Windows symlink
 * privileges.
 *
 * `prepareExecution` mirrors project-root entries into a virtual filesystem
 * layout after build. On Windows, a directory entry that is itself a symlink
 * needs to be mirrored as a junction; otherwise `fs.symlinkSync` defaults to a
 * privileged directory symlink and fails with EPERM.
 *
 * 1. Create a CJS ttsx project whose `node_modules` entry is a junction.
 * 2. Run ttsx against the entry.
 * 3. Assert the virtual-layout mirror completes and the entry executes.
 */
export const test_ttsx_virtual_layout_junctions_symlinked_directory_entries_on_windows =
  () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts": `const message: string = "junction-ok";\nconsole.log(message);\n`,
    });
    const linkedModules = TestProject.tmpdir("ttsx-linked-node-modules-");
    const nodeModules = path.join(root, "node_modules");
    fs.symlinkSync(
      linkedModules,
      nodeModules,
      process.platform === "win32" ? "junction" : undefined,
    );
    assert.equal(fs.lstatSync(nodeModules).isSymbolicLink(), true);

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "junction-ok");
  };

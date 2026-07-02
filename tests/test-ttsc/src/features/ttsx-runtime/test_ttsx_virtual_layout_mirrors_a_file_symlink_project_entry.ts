import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx mirrors a project-root entry that is a file symlink.
 *
 * `prepareExecution::linkVirtualEntry` mirrors project-root entries into the
 * virtual filesystem layout. Directory entries and directory-target symlinks
 * get junction handling, plain files get hard-link/copy, but a file symlink
 * falls through to the re-symlink branch — which on Windows requires
 * `SeCreateSymbolicLinkPrivilege` and now falls back to hard-link/copy instead
 * of aborting the run (#306). This locks the branch: a file-symlink entry must
 * never fail the virtual-layout mirror.
 *
 * 1. Create a CJS ttsx project whose root contains a symlink to a file outside the
 *    project.
 * 2. Run ttsx against the entry.
 * 3. Assert the virtual-layout mirror completes and the entry executes.
 */
export const test_ttsx_virtual_layout_mirrors_a_file_symlink_project_entry =
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
      "src/main.ts": `const message: string = "file-symlink-ok";\nconsole.log(message);\n`,
    });
    const linkedFile = path.join(
      TestProject.tmpdir("ttsx-linked-file-"),
      "linked.txt",
    );
    fs.writeFileSync(linkedFile, "linked", "utf8");
    const entry = path.join(root, "linked.txt");
    fs.symlinkSync(linkedFile, entry);
    assert.equal(fs.lstatSync(entry).isSymbolicLink(), true);

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "file-symlink-ok");
  };

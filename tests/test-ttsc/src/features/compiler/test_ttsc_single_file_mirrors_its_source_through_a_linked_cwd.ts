import { TestProject } from "@ttsc/testing";

import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies positional `ttsc <file>` writes its output at the same place when
 * the cwd reaches the project through a link.
 *
 * The project resolves to its physical directory, and the output mirrored the
 * requested file below that `rootDir` with `path.relative`, which compared the
 * physical `rootDir` with the file as the cwd spelled it. Through a link the
 * file seemed to lie outside `rootDir`, so `ttsc src/index.ts` wrote
 * `lib/index.js` instead of `lib/src/index.js`, and printed it as a path
 * walking out through the link and back in. macOS reaches every project in its
 * temporary directory that way, through `/var`.
 *
 * 1. Create a project with `outDir: "lib"` and `src/index.ts`, and a link to it.
 * 2. Run `ttsc src/index.ts` with the link as the cwd.
 * 3. Assert the output is `lib/src/index.js`, named relative to the cwd.
 */
export const test_ttsc_single_file_mirrors_its_source_through_a_linked_cwd =
  (): void => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          outDir: "lib",
          target: "ES2022",
          types: [],
        },
        include: ["src"],
      }),
      "src/index.ts": `console.log("ran src/index.ts");\nexport {};\n`,
    });
    const link = path.join(TestProject.tmpdir("ttsc-linked-cwd-"), "project");
    fs.symlinkSync(root, link, "junction");

    const result = spawn(ttscBin, ["--cwd", link, "src/index.ts"], {
      cwd: link,
    });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(
      fs.existsSync(path.join(root, "lib", "src", "index.js")),
      true,
      result.stdout,
    );
    assert.equal(fs.existsSync(path.join(root, "lib", "index.js")), false);
    assert.equal(result.stdout.trim(), path.join("lib", "src", "index.js"));
  };

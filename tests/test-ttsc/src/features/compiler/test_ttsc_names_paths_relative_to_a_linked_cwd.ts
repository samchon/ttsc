import { TestProject } from "@ttsc/testing";

import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";
import { WatchSession } from "../../internal/watch";

/**
 * Verifies ttsc names the paths it reports relative to the cwd it was given
 * when that cwd reaches the project through a link.
 *
 * The project, its caches, and its watch root resolve to their physical
 * directory. The messages related that physical path to the cwd as the user
 * spelled it, so through a link `ttsc clean` printed every removed directory as
 * an absolute path, and `ttsc --watch` announced it was watching `../<the
 * physical directory>` instead of `.`. macOS reaches every project in its
 * temporary directory that way, through `/var`.
 *
 * 1. Create a project holding a legacy `node_modules/.ttsc` cache, and a link to
 *    it.
 * 2. Run `ttsc clean` with the link as the cwd, and assert it names the removed
 *    cache relative to the cwd.
 * 3. Start `ttsc --watch` with the link as the cwd, and assert it announces it is
 *    watching `.`.
 */
export const test_ttsc_names_paths_relative_to_a_linked_cwd =
  async (): Promise<void> => {
    const root = createProject({
      "src/main.ts": `export const value = 1;\n`,
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          noEmit: true,
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
    });
    fs.mkdirSync(path.join(root, "node_modules", ".ttsc"), { recursive: true });
    const link = path.join(TestProject.tmpdir("ttsc-linked-cwd-"), "project");
    fs.symlinkSync(root, link, "junction");

    const clean = spawn(ttscBin, ["clean", "--cwd", link], { cwd: link });
    assert.equal(clean.status, 0, clean.stderr);
    assert.ok(
      clean.stdout
        .split(/\r?\n/)
        .includes(`ttsc: removed ${path.join("node_modules", ".ttsc")}`),
      clean.stdout,
    );

    const session = new WatchSession(link);
    try {
      await session.waitForBuilds(1);
      assert.ok(
        session.transcript().split(/\r?\n/).includes("[ttsc] watching ."),
        session.transcript(),
      );
    } finally {
      await session.close();
    }
  };

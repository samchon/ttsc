import { TestProject } from "@ttsc/testing";

import { isolatedCacheEnvironment } from "../../internal/isolated-cache-environment";
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
 *
 * @evidence contracts/testing.md#behavioral-verification Runs clean and one WatchSession through a junction cwd, requiring project-relative legacy-cache removal and [ttsc] watching . transcript lines.
 * @evidence contracts/testing.md#independent-expectations The link resolves to the authored project, so its root-relative cache and watching-root spellings must stay relative rather than being misreported as an external physical directory.
 * @evidence contracts/testing.md#distinguishing-cases Linked versus physical cwd identity differs while content/config are shared; actual Windows short-name spelling is owned by the installed OS boundary.
 * @evidence contracts/testing.md#execution-ownership The exported TestExecutor feature performs native clean plus an actual watch process on a real junction fixture.
 * @evidence contracts/e2e.md#necessary-boundary Real alias resolution must reach launcher cleanup and watch presentation consistently; pure path-string units cannot prove a kernel junction selects the same project.
 * @evidence contracts/e2e.md#shared-execution One linked project supplies both commands. Clean and watch are separate required lifetimes; WatchSession reuses its initial build for the watching-root assertion without contributor builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The registered physical/link roots isolate alias state, isolatedCacheEnvironment confines clean, and finally closes the WatchSession before fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Both original relative transcript assertions and clean success remain. The test does not modify a source through the link or assert a subsequent rebuild.
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

    const clean = spawn(ttscBin, ["clean", "--cwd", link], {
      cwd: link,
      env: isolatedCacheEnvironment(root),
    });
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

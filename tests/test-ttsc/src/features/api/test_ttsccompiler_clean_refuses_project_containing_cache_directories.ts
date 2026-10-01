import os from "node:os";
import { TestProject } from "../../../../utils/src/TestProject";
import { TtscCompiler } from "../../../../../packages/ttsc/src/TtscCompiler";
import { resolveSafeCacheCleanupTargets } from "../../../../../packages/ttsc/src/internal/resolveSafeCacheCleanupTargets";
import {
  assert,
  fs,
  path,
} from "../../internal/script-unit";

/**
 * Verifies TtscCompiler.clean validates every cache cleanup target before
 * mutating the filesystem.
 *
 * A mistaken `cacheDir: "."`, external `TTSC_GO_CACHE_DIR`, project ancestor,
 * physical alias, or filesystem root must be rejected with every sentinel
 * intact. A real regression is contained to a test-owned temporary parent; the
 * alias and filesystem-root cases call the pure guard only.
 *
 * 1. Reject explicit project and ancestor cache roots without removing data.
 * 2. Reject a physical alias and an environment-selected project ancestor.
 * 3. Reject a filesystem root and assert every earlier sentinel still exists.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscCompiler.clean and resolveSafeCacheCleanupTargets reject project, ancestor, alias, environment-selected ancestor and filesystem-root targets before removing any sentinel.
 * @evidence contracts/testing.md#independent-expectations Literal project, sibling and plugin sentinels independently establish what must survive an invalid cleanup request.
 * @evidence contracts/testing.md#distinguishing-cases Direct project and ancestor requests, physical alias, instance environment and filesystem root are all rejected while earlier data remains intact.
 * @evidence contracts/testing.md#execution-ownership A unit test running TtscCompiler.clean and resolveSafeCacheCleanupTargets in process over a throwaway project, a sibling file and a junction in os.tmpdir(); no tsgo compile, native plugin build or ttsc CLI process is started.
 */
export function test_ttsccompiler_clean_refuses_project_containing_cache_directories() {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-clean-safety-"));
    const project = path.join(parent, "project");
    const projectSentinel = path.join(project, "src", "main.ts");
    const siblingSentinel = path.join(parent, "keep.txt");
    const pluginSentinel = path.join(
      project,
      "node_modules",
      ".cache",
      "ttsc",
      "plugins",
      "keep.txt",
    );
    const aliasRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-clean-safety-alias-"),
    );
    try {
      TestProject.writeFiles(project, {
        "src/main.ts": 'export const keep = "project";\n',
        "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "commonjs", strict: true, outDir: "dist", declaration: true, declarationMap: true, rootDir: "src", sourceMap: true }, include: ["src"] }, null, 2),
      });
      fs.writeFileSync(siblingSentinel, "sibling", "utf8");
      fs.mkdirSync(path.dirname(pluginSentinel), { recursive: true });
      fs.writeFileSync(pluginSentinel, "plugin", "utf8");

      for (const cacheDir of [project, parent]) {
        const compiler = new TtscCompiler({ cacheDir, cwd: project });
        assert.throws(
          () => compiler.clean(),
          /refusing to clean cache directory.*equals or contains project root/,
        );
        assert.equal(fs.readFileSync(projectSentinel, "utf8").length > 0, true);
        assert.equal(fs.readFileSync(siblingSentinel, "utf8"), "sibling");
      }

      const alias = path.join(aliasRoot, "parent");
      fs.symlinkSync(parent, alias, "junction");
      assert.throws(
        () =>
          resolveSafeCacheCleanupTargets(project, [
            path.join(alias, "project"),
          ]),
        /refusing to clean cache directory.*equals or contains project root/,
      );

      assert.throws(
        () =>
          new TtscCompiler({
            cwd: project,
            env: {
              TTSC_CACHE_DIR: path.join(
                project,
                "node_modules",
                ".cache",
                "ttsc",
              ),
              TTSC_GO_CACHE_DIR: parent,
            },
          }).clean(),
        /refusing to clean cache directory.*equals or contains project root/,
      );
      assert.equal(fs.readFileSync(pluginSentinel, "utf8"), "plugin");
      assert.equal(fs.readFileSync(projectSentinel, "utf8").length > 0, true);
      assert.equal(fs.readFileSync(siblingSentinel, "utf8"), "sibling");

      assert.throws(
        () =>
          resolveSafeCacheCleanupTargets(project, [
            path.parse(path.resolve(project)).root,
          ]),
        /filesystem roots are never valid cache directories/,
      );
      assert.equal(fs.existsSync(projectSentinel), true);
      assert.equal(fs.existsSync(siblingSentinel), true);
    } finally {
      fs.rmSync(aliasRoot, { force: true, recursive: true });
      fs.rmSync(parent, { force: true, recursive: true });
    }
}
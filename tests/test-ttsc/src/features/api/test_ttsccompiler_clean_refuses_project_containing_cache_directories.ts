import { assertSafeExplicitCacheDirectory } from "../../../../../packages/ttsc/lib/internal/assertSafeExplicitCacheDirectory.js";
import {
  TtscCompiler,
  assert,
  fs,
  os,
  path,
  writeBasicProject,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.clean validates every explicit wholesale deletion
 * before mutating the filesystem.
 *
 * A mistaken `cacheDir: "."`, a project ancestor, or a filesystem root must be
 * rejected with the project and sibling sentinels intact. A real regression is
 * contained to a test-owned temporary parent; the filesystem-root case calls
 * the pure guard only and can never attempt deletion.
 */
export const test_ttsccompiler_clean_refuses_project_containing_cache_directories =
  () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-clean-safety-"));
    const project = path.join(parent, "project");
    const projectSentinel = path.join(project, "src", "main.ts");
    const siblingSentinel = path.join(parent, "keep.txt");
    try {
      writeBasicProject(project, 'export const keep = "project";\n');
      fs.writeFileSync(siblingSentinel, "sibling", "utf8");

      for (const cacheDir of [project, parent]) {
        const compiler = new TtscCompiler({ cacheDir, cwd: project });
        assert.throws(
          () => compiler.clean(),
          /refusing to clean cache directory.*equals or contains project root/,
        );
        assert.equal(fs.readFileSync(projectSentinel, "utf8").length > 0, true);
        assert.equal(fs.readFileSync(siblingSentinel, "utf8"), "sibling");
      }

      assert.throws(
        () =>
          assertSafeExplicitCacheDirectory(
            project,
            path.parse(path.resolve(project)).root,
          ),
        /filesystem roots are never valid cache directories/,
      );
      assert.equal(fs.existsSync(projectSentinel), true);
      assert.equal(fs.existsSync(siblingSentinel), true);
    } finally {
      fs.rmSync(parent, { force: true, recursive: true });
    }
  };

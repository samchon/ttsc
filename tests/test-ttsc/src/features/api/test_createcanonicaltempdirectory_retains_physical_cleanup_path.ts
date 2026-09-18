import { type CanonicalTempDirectoryOperations } from "../../../../../packages/ttsc/lib/internal/CanonicalTempDirectoryOperations.js";
import { createCanonicalTempDirectory } from "../../../../../packages/ttsc/lib/internal/createCanonicalTempDirectory.js";
import { assert, fs, path } from "../../internal/compiler";

/**
 * Verifies temporary cleanup retains the directory's physical spelling.
 *
 * A caller-controlled TEMP/TMPDIR parent can be a symlink or junction. If that
 * alias is retargeted after creation, cleanup through the original spelling can
 * remove an unrelated same-named directory. The helper must instead resolve the
 * parent before creation, create beneath that physical spelling, and reject any
 * child whose postflight identity is not a direct child.
 *
 * 1. Retarget a real parent alias while the helper creates its child.
 * 2. Assert writes and cleanup remain below the original physical parent.
 * 3. Assert non-directory parents and escaped postflights fail closed.
 */
export const test_createcanonicaltempdirectory_retains_physical_cleanup_path =
  (): void => {
    const root = createCanonicalTempDirectory("ttsc-canonical-temp-test-");
    const safeParent = path.join(root, "safe");
    const project = path.join(root, "project");
    const alias = path.join(root, "temp-alias");
    fs.mkdirSync(safeParent);
    fs.mkdirSync(project);
    try {
      fs.symlinkSync(safeParent, alias, "junction");
      const calls: string[] = [];
      const operations: CanonicalTempDirectoryOperations = {
        lstat: (location) => {
          calls.push(`lstat:${location}`);
          return fs.lstatSync(location);
        },
        mkdtemp: (prefix) => {
          calls.push(`mkdtemp:${prefix}`);
          const directory = fs.mkdtempSync(prefix);
          fs.unlinkSync(alias);
          fs.symlinkSync(project, alias, "junction");
          const victim = path.join(project, path.basename(directory));
          fs.mkdirSync(victim);
          fs.writeFileSync(
            path.join(victim, "keep.txt"),
            "project data",
            "utf8",
          );
          return directory;
        },
        realpath: (location) => {
          calls.push(`realpath:${location}`);
          return fs.realpathSync.native(location);
        },
      };
      const directory = createCanonicalTempDirectory(
        "ttsc-child-",
        alias,
        operations,
      );
      const name = path.basename(directory);
      assert.equal(path.dirname(directory), fs.realpathSync.native(safeParent));
      assert.deepEqual(calls, [
        `realpath:${alias}`,
        `lstat:${safeParent}`,
        `mkdtemp:${path.join(safeParent, "ttsc-child-")}`,
        `lstat:${directory}`,
        `realpath:${directory}`,
      ]);
      const victim = path.join(project, name);
      const sentinel = path.join(victim, "keep.txt");

      fs.rmSync(directory, { force: true, recursive: true });
      assert.equal(fs.readFileSync(sentinel, "utf8"), "project data");
      assert.equal(fs.existsSync(path.join(safeParent, name)), false);

      const physicalParent = path.resolve(root, "physical-parent");
      const escapedChild = path.resolve(root, "escaped", "child");
      assert.throws(
        () =>
          createCanonicalTempDirectory("child-", physicalParent, {
            lstat: () => ({ isDirectory: () => false }),
            mkdtemp: () => assert.fail("must not create below a file"),
            realpath: () => physicalParent,
          }),
        /parent is not a directory/,
      );
      assert.throws(
        () =>
          createCanonicalTempDirectory("child-", physicalParent, {
            lstat: () => ({ isDirectory: () => true }),
            mkdtemp: (prefix) => `${prefix}owned`,
            realpath: (location) =>
              location === physicalParent ? physicalParent : escapedChild,
          }),
        /escaped its physical parent/,
      );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };

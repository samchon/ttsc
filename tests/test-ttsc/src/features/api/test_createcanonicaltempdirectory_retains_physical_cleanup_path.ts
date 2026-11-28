import { spawnSync } from "node:child_process";

import { captureProcessOutput } from "../../../../../packages/ttsc/src/compiler/internal/captureProcessOutput";
import { type CanonicalTempDirectoryOperations } from "../../../../../packages/ttsc/src/internal/CanonicalTempDirectoryOperations";
import { createCanonicalTempDirectory } from "../../../../../packages/ttsc/src/internal/createCanonicalTempDirectory";
import { createProjectTempDirectory } from "../../../../../packages/ttsc/src/internal/createProjectTempDirectory";
import { SourceBuildCacheLayout } from "../../../../../packages/ttsc/src/plugin/internal/source/SourceBuildCacheLayout";
import { selectedRecordIdentityTempParent } from "../../../../../packages/ttsc/src/plugin/internal/source/selectedRecordIdentityTempParent";
import { assert, fs, path, workspaceRoot } from "../../internal/script-unit";

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
 * 3. Reject invalid prefixes, non-directory parents/children and escaped
 *    postflights.
 * 4. Distinguish a POSIX byte path from a legitimate U+FFFD sibling before
 *    allocating directly or selecting ambient or record-backed storage.
 *
 * @evidence contracts/testing.md#behavioral-verification createCanonicalTempDirectory pins its physical parent across alias retargeting and rejects invalid layouts. Descriptor output capture falls back to system storage when a record-backed parent has no usable string path.
 * @evidence contracts/testing.md#independent-expectations The explicitly observed operation order, physical parent and literal victim sentinel independently define safe creation and deletion.
 * @evidence contracts/testing.md#distinguishing-cases Successful alias handoff contrasts with invalid prefixes, non-directories and escaped children. Linux also contrasts a non-UTF-8 parent and the ordinary U+FFFD directory its lossy decoding would name.
 * @evidence contracts/testing.md#execution-ownership Calls the creator directly using native operations and injected failure probes. A bounded Linux Node child supplies its own TMPDIR to the selector. No native compiler or ttsc host runs. Finally removes the owned fixture.
 */
export function test_createcanonicaltempdirectory_retains_physical_cleanup_path() {
  const root = createProjectTempDirectory(
    "ttsc-canonical-temp-test-",
    process.cwd(),
  );
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
        fs.writeFileSync(path.join(victim, "keep.txt"), "project data", "utf8");
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
    for (const prefix of [
      "",
      ".",
      "..",
      path.join("nested", "child"),
      `${path.sep}child`,
    ]) {
      assert.throws(
        () =>
          createCanonicalTempDirectory(prefix, physicalParent, {
            lstat: () => assert.fail("invalid prefix must not stat"),
            mkdtemp: () => assert.fail("invalid prefix must not allocate"),
            realpath: () => assert.fail("invalid prefix must not resolve"),
          }),
        /prefix must be a basename/,
      );
    }
    assert.throws(
      () =>
        createCanonicalTempDirectory("child-", physicalParent, {
          lstat: (location) => ({
            isDirectory: () => location === physicalParent,
          }),
          mkdtemp: (prefix) => `${prefix}owned`,
          realpath: () => physicalParent,
        }),
      /postflight is not a directory/,
    );
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
    if (process.platform === "linux") verifyRawParent(root, project);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}

/** Neither allocator may select the valid directory a raw path decodes to. */
function verifyRawParent(root: string, project: string): void {
  const raw = Buffer.concat([
    Buffer.from(`${root}/native-`),
    Buffer.from([0xff]),
  ]);
  const lookalike = path.join(root, "native-\ufffd");
  const rawIdentities = Buffer.concat([raw, Buffer.from("/identities")]);
  const lookalikeIdentities = path.join(lookalike, "identities");
  const alias = path.join(root, "raw-temp-alias");
  try {
    fs.mkdirSync(raw);
    fs.mkdirSync(lookalike);
    fs.symlinkSync(raw, alias);
    assert.throws(
      () => createCanonicalTempDirectory("child-", alias),
      /temporary directory parent has no UTF-8 path/,
    );
    assert.deepEqual(fs.readdirSync(lookalike), []);
    const authoredCache = path.join(alias, "node_modules", ".cache", "ttsc");
    assert.throws(
      () => SourceBuildCacheLayout.defaultWorkspaceCachePath(authoredCache),
      /cache path has no UTF-8 spelling/,
    );
    assert.throws(
      () => SourceBuildCacheLayout.canonicalPluginCacheRoot(authoredCache),
      /cache path has no UTF-8 spelling/,
    );
    assert.deepEqual(fs.readdirSync(raw), []);
    assert.deepEqual(fs.readdirSync(lookalike), []);
    const legitimate = createCanonicalTempDirectory("child-", lookalike);
    assert.equal(path.dirname(legitimate), lookalike);
    fs.rmdirSync(legitimate);

    fs.mkdirSync(rawIdentities);
    fs.mkdirSync(lookalikeIdentities);
    assert.equal(selectedRecordIdentityTempParent(alias, [project]), undefined);
    assert.equal(
      selectedRecordIdentityTempParent(lookalike, [alias, project]),
      lookalikeIdentities,
    );
    const capture = captureProcessOutput(
      { TTSC_PLUGIN_DESCRIPTOR_LOAD: "1", TTSC_PLUGIN_RECORD_ROOT: alias },
      undefined,
      project,
    );
    try {
      assert.notEqual(
        path.dirname(path.dirname(capture.stdoutPath)),
        lookalikeIdentities,
      );
      assert.deepEqual(fs.readdirSync(lookalikeIdentities), []);
    } finally {
      capture.dispose();
    }

    const selector = path.join(
      workspaceRoot,
      "packages/ttsc/src/internal/systemTempOutsideProject.ts",
    );
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        path.join(workspaceRoot, "config/register-unit-loader.mjs"),
        "-e",
        `const { systemTempOutsideProject } = require(${JSON.stringify(selector)});
        process.stdout.write(JSON.stringify([...systemTempOutsideProject.candidates(${JSON.stringify(project)})]));`,
      ],
      {
        env: { ...process.env, TMPDIR: alias },
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const candidates: { directory: string; spelling: string }[] = JSON.parse(
      result.stdout,
    );
    assert.ok(
      candidates.every(
        ({ directory, spelling }) =>
          directory !== lookalike && spelling !== alias,
      ),
    );
  } finally {
    if (fs.existsSync(alias)) fs.unlinkSync(alias);
    if (fs.existsSync(rawIdentities)) fs.rmdirSync(rawIdentities);
    if (fs.existsSync(raw)) fs.rmdirSync(raw);
  }
}

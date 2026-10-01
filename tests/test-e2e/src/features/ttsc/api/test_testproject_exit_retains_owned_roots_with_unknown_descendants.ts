import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Verifies exit preserves the original owned root after explicit retention.
 *
 * An unresolved descendant may still read fixture inputs. The owning process
 * must transfer only its actual allocation out of exit cleanup, without
 * granting that authority to foreign paths or another spelling of the root.
 * This fixture declares uncertainty; it does not fabricate a native orphan.
 *
 * 1. Allocate a tracked root in a real Node child and write distinctive bytes.
 * 2. Reject untracked, aliased, linked, removed and replaced allocation requests.
 * 3. Retain the original root and join the child process.
 * 4. Assert identical directory identity and bytes, then remove the parent fixture.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual TestProject allocation and retention in a child that really exits; the parent checks surviving native directory identity and literal input bytes rather than a cleanup flag.
 * @evidence contracts/testing.md#independent-expectations The explicit retention contract requires the same originally allocated directory to survive exit. Foreign and retired paths lack allocation authority, and a different path spelling cannot transfer ownership.
 * @evidence contracts/testing.md#distinguishing-cases Checks retained allocation, tracked ancestor protection, idempotent retention and refusal of untracked, trailing-separator alias, native directory link, removed and physically replaced roots; refused replacement occupants and the link target must survive child exit. The normal-release companion checks cleanup without retention.
 * @evidence contracts/testing.md#execution-ownership The named features/api export belongs to E2E discovery and selection because it observes an actual Node exit listener across the process boundary.
 * @evidence contracts/e2e.md#necessary-boundary The owning process exits before the parent reads retained inputs. A mocked exit callback or a direct cleanup call cannot detect erroneous automatic release at real process termination.
 * @evidence contracts/e2e.md#shared-execution One Node child exercises all retention distinctions using the authored helper. No SDK installation, Go producer or product host is started.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity All roots are below a unique parent fixture; the parent joins the child before reclaiming the retained input. Retention does not certify native descendant closure, and no foreign/shared root is removed.
 * @evidence contracts/e2e.md#preserved-coverage Adds exact retained-identity and refusal oracles without removing or weakening existing compiler/process tests; normal tracked exit release remains in the companion entry.
 */
export const test_testproject_exit_retains_owned_roots_with_unknown_descendants = () => {
  const outer = TestProject.tmpdir("ttsc-exit-cleanup-retained-");
  try {
    const helper = pathToFileURL(path.join(TestProject.TEST_PACKAGE_ROOT,
      "src", "TestProject.ts")).href;
    const child = spawnSync(process.execPath, ["--experimental-strip-types",
      "--import", pathToFileURL(path.join(TestProject.WORKSPACE_ROOT,
        "config", "register-typescript-loader.mjs")).href,
      "--input-type=module", "-e", [
        "import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';",
        `const { TestProject } = await import(${JSON.stringify(helper)});`,
        `const outer = ${JSON.stringify(outer)};`,
        "const parent = TestProject.tmpdir('parent-', outer);",
        "const root = TestProject.tmpdir('child-', parent);",
        "fs.writeFileSync(path.join(root, 'input.txt'), 'retained input');",
        "const original = fs.lstatSync(root);",
        "const foreign = fs.mkdtempSync(path.join(outer, 'foreign-'));",
        "fs.writeFileSync(path.join(foreign, 'sentinel.txt'), 'untracked input');",
        "assert.throws(() => TestProject.retainTemporaryDirectory(foreign, 'unknown'), /owned allocation/);",
        "assert.throws(() => TestProject.retainTemporaryDirectory(root + path.sep, 'unknown'), /owned allocation/);",
        "const removed = TestProject.tmpdir('removed-', outer); fs.rmdirSync(removed);",
        "assert.throws(() => TestProject.retainTemporaryDirectory(removed, 'unknown'), /ENOENT/);",
        "const replaced = TestProject.tmpdir('replaced-', outer);",
        "fs.renameSync(replaced, replaced + '-original'); fs.mkdirSync(replaced);",
        "assert.throws(() => TestProject.retainTemporaryDirectory(replaced, 'unknown'), /identity changed/);",
        "const linked = TestProject.tmpdir('linked-', outer); fs.renameSync(linked, linked + '-original');",
        "fs.symlinkSync(foreign, linked, process.platform === 'win32' ? 'junction' : 'dir');",
        "assert.throws(() => TestProject.retainTemporaryDirectory(linked, 'unknown'), /aliased or linked/);",
        "TestProject.retainTemporaryDirectory(root, 'descendant completion is unknown');",
        "TestProject.retainTemporaryDirectory(root, 'still unknown');",
        "console.log(JSON.stringify({ parent: path.basename(parent), name: path.basename(root), replaced: path.basename(replaced), foreign: path.basename(foreign), linked: path.basename(linked), dev: original.dev, ino: original.ino, birthtimeMs: original.birthtimeMs }));",
      ].join("\n")], { cwd: TestProject.WORKSPACE_ROOT, encoding: "utf8",
      timeout: 30_000, windowsHide: true });
    assert.ifError(child.error);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
    const record = JSON.parse(child.stdout.trim()) as {
      parent: string; name: string; replaced: string; foreign: string; linked: string;
      dev: number; ino: number; birthtimeMs: number;
    };
    assert.match(record.name, /^child-[A-Za-z0-9]+$/);
    assert.match(record.parent, /^parent-[A-Za-z0-9]+$/);
    assert.match(record.replaced, /^replaced-[A-Za-z0-9]+$/);
    assert.match(record.foreign, /^foreign-[A-Za-z0-9]+$/);
    assert.match(record.linked, /^linked-[A-Za-z0-9]+$/);
    const root = path.join(outer, record.parent, record.name);
    const actual = fs.lstatSync(root);
    assert.equal(actual.isDirectory(), true);
    assert.equal(actual.isSymbolicLink(), false);
    assert.equal(actual.dev, record.dev);
    assert.equal(actual.ino, record.ino);
    assert.equal(actual.birthtimeMs, record.birthtimeMs);
    assert.equal(fs.readFileSync(path.join(root, "input.txt"), "utf8"), "retained input");
    assert.equal(fs.lstatSync(path.join(outer, record.replaced)).isDirectory(), true,
      "a refused replaced allocation cannot become exit-cleanup authority");
    assert.equal(fs.lstatSync(path.join(outer, record.linked)).isSymbolicLink(), true);
    assert.equal(fs.readFileSync(path.join(outer, record.foreign, "sentinel.txt"), "utf8"),
      "untracked input");
  } finally {
    fs.rmSync(outer, { recursive: true, force: true });
  }
};

import os from "node:os";

import { captureProcessOutput } from "../../../../../packages/ttsc/src/compiler/internal/captureProcessOutput";
import { assert, fs, path } from "../../internal/script-unit";

/**
 * Verifies a descriptor capture uses its selected existing identity directory.
 *
 * A child can inherit TEMP equal to the project root. Creating a capture there
 * would change the root metadata used to prove missing descriptor inputs.
 *
 * 1. Prepare a project with an ordinary cache identities directory and capture
 *    bytes under an invocation-selected descriptor environment.
 * 2. Confirm the project root remains stable and disposal removes the capture.
 * 3. Contrast an absent marker, missing root and linked identities directory with
 *    ordinary system TEMP capture.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual capture opens two writable descriptors, returns their written bytes and removes its directory; its selected path stays below identities without changing project-root metadata, while unselected or unsafe inputs use system TEMP.
 * @evidence contracts/testing.md#independent-expectations Authored stream bytes, the existing project and identities paths, and native root timestamps determine the expected capture behavior without deriving it from the selector under test.
 * @evidence contracts/testing.md#distinguishing-cases A current selected root nested below project/node_modules/.cache contrasts with absent marker, absent identities and a linked identities entry; selected cleanup and generic TEMP cleanup both preserve their independently owned parent directories.
 * @evidence contracts/testing.md#execution-ownership The named unit calls the maintained capture owner directly with private filesystem fixtures and supplied environment objects; it starts no native compiler or plugin host and removes its exact scratch root in finally.
 */
export function test_captureprocessoutput_uses_selected_descriptor_identities(): void {
  const systemParent = fs.realpathSync.native(os.tmpdir());
  const ownedPrefix = "ttsc-capture-parent-";
  const root = fs.mkdtempSync(path.join(systemParent, ownedPrefix));
  let linkedAlias: string | undefined;
  try {
    const project = path.join(root, "project");
    const cacheRoot = path.join(project, "node_modules", ".cache", "ttsc");
    const identities = path.join(cacheRoot, "identities");
    fs.mkdirSync(identities, { recursive: true });
    const selectedEnv = {
      TTSC_PLUGIN_DESCRIPTOR_LOAD: "1",
      TTSC_PLUGIN_RECORD_ROOT: cacheRoot,
    };
    const before = fs.statSync(project, { bigint: true }).mtimeNs;
    const selected = captureProcessOutput(selectedEnv);
    try {
      assert.equal(
        path.dirname(selected.stdoutPath),
        path.dirname(selected.stderrPath),
      );
      assert.equal(path.dirname(path.dirname(selected.stdoutPath)), identities);
      fs.writeSync(selected.stdoutFd, "selected stdout");
      fs.writeSync(selected.stderrFd, "selected stderr");
      assert.equal(selected.read("stdout", "utf8"), "selected stdout");
      assert.equal(selected.read("stderr", "utf8"), "selected stderr");
    } finally {
      selected.dispose();
    }
    assert.equal(fs.existsSync(path.dirname(selected.stdoutPath)), false);
    assert.equal(fs.statSync(project, { bigint: true }).mtimeNs, before);

    for (const env of [
      { TTSC_PLUGIN_RECORD_ROOT: cacheRoot },
      {
        TTSC_PLUGIN_DESCRIPTOR_LOAD: "1",
        TTSC_PLUGIN_RECORD_ROOT: path.join(root, "missing"),
      },
    ]) {
      const fallback = captureProcessOutput(env);
      try {
        assert.equal(
          path.dirname(path.dirname(fallback.stdoutPath)),
          systemParent,
        );
      } finally {
        fallback.dispose();
      }
    }

    const linkedRoot = path.join(root, "linked-root");
    const target = path.join(root, "target");
    fs.mkdirSync(linkedRoot);
    fs.mkdirSync(target);
    linkedAlias = path.join(linkedRoot, "identities");
    fs.symlinkSync(target, linkedAlias, "junction");
    const linked = captureProcessOutput({
      TTSC_PLUGIN_DESCRIPTOR_LOAD: "1",
      TTSC_PLUGIN_RECORD_ROOT: linkedRoot,
    });
    try {
      assert.equal(path.dirname(path.dirname(linked.stdoutPath)), systemParent);
      assert.deepEqual(fs.readdirSync(target), []);
    } finally {
      linked.dispose();
    }
  } finally {
    if (linkedAlias !== undefined) {
      let linkedStats: fs.Stats | undefined;
      try {
        linkedStats = fs.lstatSync(linkedAlias);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (linkedStats !== undefined) {
        assert.equal(linkedStats.isSymbolicLink(), true);
        assert.equal(
          fs.realpathSync.native(linkedAlias),
          fs.realpathSync.native(path.join(root, "target")),
        );
        fs.unlinkSync(linkedAlias);
      }
    }
    assert.equal(fs.realpathSync.native(path.dirname(root)), systemParent);
    assert.ok(path.basename(root).startsWith(ownedPrefix));
    assert.equal(fs.lstatSync(root).isDirectory(), true);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

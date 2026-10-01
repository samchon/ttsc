import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveSafeCacheCleanupTargets } from "../../../../../packages/ttsc/src/internal/resolveSafeCacheCleanupTargets";

/**
 * Verifies cache cleanup pins alias ancestors without following terminal links.
 *
 * Recursive removal must not re-resolve a mutable alias ancestor after target
 * validation. A terminal cache symlink is different: Node removes that link
 * itself rather than its destination, and physical pinning must preserve that
 * established behavior instead of leaving a dangling link behind.
 *
 * 1. Retarget an alias after resolving a nested directory and preserve the new
 *    target.
 * 2. Retarget the same alias while resolving a terminal cache link.
 * 3. Assert both deletion paths stay under the original physical parent and
 *    terminal-link destinations survive.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveSafeCacheCleanupTargets pins ancestor identity while preserving terminal links, so bounded deletion removes the original cache/link and preserves unrelated targets.
 * @evidence contracts/testing.md#independent-expectations The independent victim and target sentinels, physical original cache and lexical terminal-link path establish the supported cleanup contract.
 * @evidence contracts/testing.md#distinguishing-cases Two cases: an ordinary nested cache directory behind an alias retargeted after the targets were resolved but before deletion, and a terminal symlink/junction cache whose alias ancestor is retargeted from inside the lstat hook during resolution; the resolved path must stay under the original physical parent, removing it must not touch the victim tree, and a terminal link is removed itself while its destination survives.
 * @evidence contracts/testing.md#execution-ownership A unit test calling resolveSafeCacheCleanupTargets and fs.rmSync directly over junctions/symlinks in a private temp directory; no ttsc clean command, process or native build.
 */
export function test_resolvesafecachecleanuptargets_pins_alias_ancestors_and_preserves_terminal_links() {
    const root = TestProject.tmpdir("ttsc-clean-target-alias-");
    const project = path.join(root, "project");
    const original = path.join(root, "original");
    const victim = path.join(root, "victim");
    const alias = path.join(root, "cache-parent");
    for (const directory of [project, original, victim]) {
      fs.mkdirSync(directory);
    }
    const originalCache = path.join(original, "cache");
    const victimCache = path.join(victim, "cache");
    fs.mkdirSync(originalCache);
    fs.mkdirSync(victimCache);
    fs.writeFileSync(path.join(victimCache, "keep.txt"), "victim", "utf8");
    fs.symlinkSync(
      original,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );

    const [pinned] = resolveSafeCacheCleanupTargets(project, [
      path.join(alias, "cache"),
    ]);
    assert.ok(pinned);
    assert.equal(pinned.exists, true);
    assert.equal(pinned.path, fs.realpathSync.native(originalCache));
    fs.rmSync(alias, { force: true, recursive: true });
    fs.symlinkSync(
      victim,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    fs.rmSync(pinned.path, { force: true, recursive: true });
    assert.equal(fs.existsSync(originalCache), false);
    assert.equal(
      fs.readFileSync(path.join(victimCache, "keep.txt"), "utf8"),
      "victim",
    );

    fs.rmSync(alias, { force: true, recursive: true });
    fs.symlinkSync(
      original,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    const originalTerminalTarget = path.join(root, "original-terminal-target");
    const victimTerminalTarget = path.join(root, "victim-terminal-target");
    const originalTerminalLink = path.join(original, "terminal-link");
    const victimTerminalLink = path.join(victim, "terminal-link");
    for (const directory of [originalTerminalTarget, victimTerminalTarget]) {
      fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, "keep.txt"), "target", "utf8");
    }
    fs.symlinkSync(
      originalTerminalTarget,
      originalTerminalLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    fs.symlinkSync(
      victimTerminalTarget,
      victimTerminalLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    let retargeted = false;
    const [terminal] = resolveSafeCacheCleanupTargets(
      project,
      [path.join(alias, "terminal-link")],
      {
        lstat: (location) => {
          if (!retargeted && path.basename(location) === "terminal-link") {
            fs.rmSync(alias, { force: true, recursive: true });
            fs.symlinkSync(
              victim,
              alias,
              process.platform === "win32" ? "junction" : "dir",
            );
            retargeted = true;
          }
          return fs.lstatSync(location);
        },
        realpath: fs.realpathSync.native,
      },
    );
    assert.ok(terminal);
    assert.equal(retargeted, true);
    assert.equal(terminal.exists, true);
    assert.equal(
      terminal.path,
      path.join(fs.realpathSync.native(original), "terminal-link"),
    );
    fs.rmSync(terminal.path, { force: true, recursive: true });
    assert.equal(fs.existsSync(originalTerminalLink), false);
    assert.equal(fs.lstatSync(victimTerminalLink).isSymbolicLink(), true);
    assert.equal(
      fs.readFileSync(path.join(originalTerminalTarget, "keep.txt"), "utf8"),
      "target",
    );
    assert.equal(
      fs.readFileSync(path.join(victimTerminalTarget, "keep.txt"), "utf8"),
      "target",
    );
}
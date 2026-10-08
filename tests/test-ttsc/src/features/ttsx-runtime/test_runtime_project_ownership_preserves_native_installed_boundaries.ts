import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { RuntimeProjectOwnership } from "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeProjectOwnership";

/**
 * Verifies project ownership against actual installed-directory identities.
 *
 * 1. Build native lower/upper store spellings and a physical workspace link.
 * 2. Observe native aliasing, then mutate only links this test created.
 * 3. Check cached selection after own-config and alias topology changes.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls both production ownership decisions on actual physical files and uses native require.resolve/realpath to prove package and alias identities. Config creation/deletion and link changes exercise live cache reuse.
 * @evidence contracts/testing.md#independent-expectations Literal consumer/own config paths and null at a proven installed boundary establish the oracle; workspace targets physically outside the store retain their consumer config. Expected identity follows native realpath, not an OS-name casing assumption.
 * @evidence contracts/testing.md#distinguishing-cases Covers exact lower boundary, native uppercase alias, a distinct uppercase directory where supported, near own config and deletion, alias addition/removal, workspace target, nested boundary, nonmatching basename and literal POSIX backslash data. Native aliases are never removed unless this test created that link.
 * @evidence contracts/testing.md#execution-ownership One filesystem source unit with private temporary inputs invokes the maintained owner, collects independent case failures and removes its own tree. No compiler, native producer, install, runtime host or foreign patch is involved; module-owned cache entries have unique temp-root identities.
 */
export function test_runtime_project_ownership_preserves_native_installed_boundaries(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-boundary-"));
  const failures: Error[] = [];
  const write = (file: string, text = "") => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
    return fs.realpathSync.native(target);
  };
  const check = (label: string, action: () => void) => {
    try { action(); } catch (error) { failures.push(new Error(label, { cause: error })); }
  };
  const nearest = RuntimeProjectOwnership.nearestTsconfig;
  const installed = RuntimeProjectOwnership.isInstalledPackageSource;
  try {
    const config = write("app/tsconfig.json", "{}");
    const lower = write("lower/tsconfig.json", "{}");
    const exact = write("lower/node_modules/pkg/index.cts");
    check("exact lower", () => {
      assert.equal(installed(exact), true);
      assert.equal(nearest(exact), null);
      assert.notEqual(nearest(exact), lower);
    });
    const upper = write("app/NODE_MODULES/pkg/index.cts");
    write("app/NODE_MODULES/pkg/package.json", '{"main":"index.cts"}');
    const store = path.dirname(path.dirname(upper));
    const alias = path.join(path.dirname(store), "node_modules");
    const naturalAlias = fs.existsSync(alias);
    let createdAlias = false;
    if (!naturalAlias) check("distinct native spelling before alias", () => {
      assert.equal(installed(upper), false);
      assert.equal(nearest(upper), config);
    });
    if (!naturalAlias) {
      fs.symlinkSync(store, alias, process.platform === "win32" ? "junction" : "dir");
      createdAlias = true;
    }
    check("proven physical alias", () => {
      assert.equal(fs.realpathSync.native(alias), fs.realpathSync.native(store));
      assert.equal(fs.realpathSync.native(createRequire(path.join(root, "app/entry.cjs")).resolve("pkg")), upper);
      assert.equal(installed(upper), true);
      assert.equal(nearest(upper), null);
    });
    const own = write("app/NODE_MODULES/pkg/tsconfig.json", "{}");
    check("near own config", () => assert.equal(nearest(upper), own));
    fs.unlinkSync(own);
    check("deleted own config", () => assert.equal(nearest(upper), null));
    const nested = write("app/NODE_MODULES/pkg/node_modules/nested/index.cts");
    write("app/NODE_MODULES/pkg/tsconfig.json", "{}");
    check("nested installed boundary", () => assert.equal(nearest(nested), null));
    fs.unlinkSync(own);
    if (createdAlias) {
      assert.equal(fs.lstatSync(alias).isSymbolicLink(), true);
      fs.unlinkSync(alias);
      check("removed alias invalidates cached boundary", () => {
        assert.equal(installed(upper), false);
        assert.equal(nearest(upper), config);
      });
    }
    const workspace = write("app/workspace/index.cts");
    const workspaceLink = path.join(store, "workspace");
    fs.symlinkSync(path.dirname(workspace), workspaceLink, process.platform === "win32" ? "junction" : "dir");
    check("physical workspace", () => {
      const physical = fs.realpathSync.native(path.join(workspaceLink, "index.cts"));
      assert.equal(physical, workspace);
      assert.equal(installed(physical), false);
      assert.equal(nearest(physical), config);
    });
    const ordinary = write("app/node_modules-other/pkg/index.cts");
    check("unrelated basename", () => {
      assert.equal(installed(ordinary), false);
      assert.equal(nearest(ordinary), config);
    });
    if (path.sep === "/") {
      const literal = write("app/literal\\node_modules\\data/index.cts");
      check("native backslash data", () => {
        assert.equal(installed(literal), false);
        assert.equal(nearest(literal), config);
      });
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  if (failures.length) throw new AggregateError(failures, "Runtime project boundary distinctions failed");
}

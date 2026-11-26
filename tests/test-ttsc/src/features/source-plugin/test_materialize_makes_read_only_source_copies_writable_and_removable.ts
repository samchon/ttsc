import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SourcePluginWorkspace } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginWorkspace";
import { pluginSourceDigest } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceDigest";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies `SourcePluginWorkspace.materialize` copies a read-only source tree
 * into an owner-writable scratch directory that preserves keyed bytes and can
 * be removed cleanly afterwards.
 *
 * Read-only source trees such as Nix store paths or read-only `node_modules`
 * have mode `0555` directories and `0444` files. `fs.cpSync` preserves those
 * modes on the copy, which makes subsequent writes into the copy and recursive
 * `fs.rmSync` cleanup fail with `EACCES`/`ENOTEMPTY`. Making the copy
 * owner-writable inside `materialize` fixes every module, overlay, external
 * replacement and contributor copy without changing its content digest.
 *
 * 1. Author a nested Go module tree and remove write permissions (`0555`
 *    directories, `0444` files).
 * 2. Materialize it into a scratch directory and assert its content digest matches
 *    the read-only source while every copied directory and file is
 *    owner-writable.
 * 3. Write into a copied subdirectory, materialize a second time over it, and
 *    remove the scratch tree with `fs.rmSync`.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls SourcePluginWorkspace.materialize and pluginSourceDigest on a real read-only directory tree, then writes into the copy, repeats materialize over it and removes the scratch root with fs.rmSync.
 * @evidence contracts/testing.md#independent-expectations Authored source files and literal owner permission masks (0o700 for directories, 0o200 for files) define the expected writable copy independently of materialize; digest equality checks content preservation.
 * @evidence contracts/testing.md#distinguishing-cases Nested read-only subdirectories and read-only files materialized once, overwritten by a second materialize, written into, and removed cleanly; skipped only on Windows or root where POSIX read-only modes do not enforce write denial.
 * @evidence contracts/testing.md#execution-ownership A unit test over one owned temporary directory; it spawns no Go process, builds no binary and restores source permissions in finally so exit cleanup removes the tree.
 */
export function test_materialize_makes_read_only_source_copies_writable_and_removable(): void {
  if (process.platform === "win32" || process.getuid?.() === 0) return;

  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-materialize-readonly-"),
  );
  const source = path.join(root, "source");
  const nested = path.join(source, "internal", "ast");
  fs.mkdirSync(nested, { recursive: true });
  const goMod = path.join(source, "go.mod");
  const astGo = path.join(nested, "ast.go");
  fs.writeFileSync(
    goMod,
    "module github.com/microsoft/typescript-go\n\ngo 1.24\n",
  );
  fs.writeFileSync(astGo, "package ast\n\nconst Kind = 1\n");

  fs.chmodSync(goMod, 0o444);
  fs.chmodSync(astGo, 0o444);
  fs.chmodSync(nested, 0o555);
  fs.chmodSync(path.join(source, "internal"), 0o555);
  fs.chmodSync(source, 0o555);

  const scratch = path.join(root, "scratch");
  const copy = path.join(scratch, "copy");
  try {
    SourcePluginWorkspace.materialize(source, copy);

    assert.equal(
      pluginSourceDigest(copy),
      pluginSourceDigest(source),
      "materialized copy preserves the exact keyed content digest",
    );
    for (const dir of [
      copy,
      path.join(copy, "internal"),
      path.join(copy, "internal", "ast"),
    ]) {
      const mode = fs.statSync(dir).mode;
      assert.equal(
        mode & 0o700,
        0o700,
        `copied directory must be owner-writable: ${dir} (mode ${(mode & 0o777).toString(8)})`,
      );
    }
    for (const file of [
      path.join(copy, "go.mod"),
      path.join(copy, "internal", "ast", "ast.go"),
    ]) {
      const mode = fs.statSync(file).mode;
      assert.equal(
        mode & 0o200,
        0o200,
        `copied file must be owner-writable: ${file} (mode ${(mode & 0o777).toString(8)})`,
      );
    }

    // Overlapping overlay copy over the already materialized tree succeeds.
    SourcePluginWorkspace.materialize(source, copy);
    // Writing a generated file inside a copied subdirectory succeeds.
    fs.writeFileSync(
      path.join(copy, "internal", "ast", "generated.go"),
      "package ast\n",
    );
    // Recursive removal of the scratch root succeeds without ENOTEMPTY/EACCES.
    fs.rmSync(scratch, { recursive: true, force: true });
    assert.equal(fs.existsSync(scratch), false);
  } finally {
    restoreWritable(root);
  }
}

function restoreWritable(target: string): void {
  try {
    const stat = fs.lstatSync(target);
    if (stat.isDirectory()) {
      fs.chmodSync(target, 0o755);
      for (const name of fs.readdirSync(target))
        restoreWritable(path.join(target, name));
    } else if (stat.isFile()) {
      fs.chmodSync(target, 0o644);
    }
  } catch {
    // Best-effort permission restoration for temp cleanup.
  }
}

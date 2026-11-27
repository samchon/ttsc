import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runtimeExecutableIdentity } from "../../../../../packages/ttsc/src/internal/runtimeExecutableIdentity";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { pluginSourceDigest } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceDigest";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that a Nix-style directory with a read-only top entry still needs
 * content proof for its descendants.
 *
 * A write to an existing Go file or executable leaves the top directory's
 * device, inode and change time intact. Future file stamps force a content read
 * even with a persistent identity store available.
 *
 * 1. Record the digest of a source tree and an executable inside the same
 *    hash-named directory.
 * 2. Rewrite both files in place and restore their modification times. Check that
 *    the top directory identity remains unchanged.
 * 3. Reopen the cache and compare both results with direct content reads.
 *
 * @evidence contracts/testing.md#behavioral-verification Real fs writes change the populations independently of the store directory; the identity store reopens on the same path before observing both changes.
 * @evidence contracts/testing.md#independent-expectations The code owners' direct content readers establish both new digests without consulting the identity store.
 * @evidence contracts/testing.md#distinguishing-cases Both populations change while the directory identity and equal-size file mtimes hold. The general identity-store tests separately exercise qualified warm reuse.
 * @evidence contracts/testing.md#execution-ownership This unit provides its own temporary source and cache and runs no compiler or executable.
 */
export function test_plugincontentidentities_observes_mutable_nix_store_descendants(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-nix-store-mutation-"),
  );
  const storeRoot = path.join(root, "store");
  const storePath = path.join(storeRoot, `${"0".repeat(32)}-tools`);
  const source = path.join(storePath, "src");
  const goFile = path.join(source, "main.go");
  const binary = path.join(storePath, "tool");
  const future = new Date(Date.now() + 3_600_000);
  const open = () => {
    const store = PluginContentIdentities.open({
      projectRoot: root,
      cacheDir: path.join(root, "cache"),
      env: { NIX_STORE_DIR: storeRoot },
    });
    assert.ok(store);
    return store;
  };

  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(goFile, "package main\nconst value = 1\n");
  fs.writeFileSync(binary, "binary-a");
  for (const file of [goFile, binary]) fs.utimesSync(file, future, future);
  if (process.platform !== "win32") fs.chmodSync(storePath, 0o555);
  try {
    const before = fs.lstatSync(storePath, { bigint: true });
    const first = open();
    const oldSource = PluginContentIdentities.sourceDirectory(first, source);
    const oldBinary = runtimeExecutableIdentity(binary, first);
    assert.equal(oldSource, pluginSourceDigest(source));
    assert.equal(oldBinary, runtimeExecutableIdentity(binary));

    fs.writeFileSync(goFile, "package main\nconst value = 2\n");
    fs.writeFileSync(binary, "binary-b");
    for (const file of [goFile, binary]) fs.utimesSync(file, future, future);
    const after = fs.lstatSync(storePath, { bigint: true });
    assert.deepEqual(
      [after.dev, after.ino, after.ctimeNs],
      [before.dev, before.ino, before.ctimeNs],
    );

    const newSource = pluginSourceDigest(source);
    const newBinary = runtimeExecutableIdentity(binary);
    assert.notEqual(newSource, oldSource);
    assert.notEqual(newBinary, oldBinary);
    const reopened = open();
    assert.equal(
      PluginContentIdentities.sourceDirectory(reopened, source),
      newSource,
    );
    assert.equal(runtimeExecutableIdentity(binary, reopened), newBinary);
  } finally {
    if (process.platform !== "win32") fs.chmodSync(storePath, 0o755);
  }
}

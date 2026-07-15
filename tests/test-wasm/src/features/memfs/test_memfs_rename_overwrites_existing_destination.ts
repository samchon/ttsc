import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation } from "../../internal/callbackFs";

/**
 * Verifies MemFS rename overwrites a compatible existing destination without
 * orphaning either side.
 *
 * POSIX `rename(2)` replaces an existing destination when the types are
 * compatible: file-onto-file overwrites the bytes, and directory-onto-empty-
 * directory replaces the empty node with the moved subtree. This pins that the
 * destination-reconciliation branch mutates atomically — the old destination
 * node is gone and the source has fully moved, with no leftover nodes.
 *
 * 1. Seed a file `/from.txt`="NEW" over an existing `/to.txt`="OLD", and a subtree
 *    `/srcdir/x.txt` over an empty `/destdir`.
 * 2. Rename file-onto-file and directory-onto-empty-directory.
 * 3. Assert both sources are gone and both destinations hold the moved content.
 */
export const test_memfs_rename_overwrites_existing_destination =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/from.txt", "NEW");
    host.writeFile("/to.txt", "OLD");
    host.mkdirp("/srcdir");
    host.writeFile("/srcdir/x.txt", "XX");
    host.mkdirp("/destdir");

    await callMutation((cb) => host.fs.rename("/from.txt", "/to.txt", cb));
    await callMutation((cb) => host.fs.rename("/srcdir", "/destdir", cb));

    TestValidator.predicate(
      "file source removed after overwrite",
      host.exists("/from.txt") === false,
    );
    TestValidator.equals(
      "destination file overwritten",
      host.readFileText("/to.txt"),
      "NEW",
    );
    TestValidator.predicate(
      "directory source removed after overwrite",
      host.exists("/srcdir") === false &&
        host.exists("/srcdir/x.txt") === false,
    );
    TestValidator.equals(
      "moved subtree landed on the replaced directory",
      host.readFileText("/destdir/x.txt"),
      "XX",
    );
  };

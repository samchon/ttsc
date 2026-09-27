import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  pruneCacheFileRoot,
} from "../../internal/source-build";

/**
 * Verifies collecting a single-file cache part never throws, never creates the
 * part, and never follows a link out of the cache root.
 *
 * A collection runs as a side effect of a launch (samchon/ttsc#1562), so a
 * missing part, a file where the part should be, or a link a user placed there
 * must leave the launch and what the link points at alone.
 *
 * 1. Collect a part that does not exist, and one that is a file.
 * 2. Link a part to an outside directory holding an old entry, and collect it.
 * 3. Assert nothing threw, nothing was created, and the outside entry remains.
 */
export const test_prunecachefileroot_leaves_what_is_not_an_ordinary_directory =
  (): void => {
    const root = TestProject.tmpdir("ttsc-cache-file-guard-");
    const missing = path.join(root, "descriptors");
    pruneCacheFileRoot(missing, { force: true });
    assert.equal(
      fs.existsSync(missing),
      false,
      "the collection created a part",
    );

    const file = path.join(root, "capabilities");
    fs.writeFileSync(file, "not a directory", "utf8");
    pruneCacheFileRoot(file, { force: true });
    assert.equal(fs.readFileSync(file, "utf8"), "not a directory");

    const outside = path.join(root, "outside");
    fs.mkdirSync(outside);
    const entry = path.join(outside, "entry.js");
    fs.writeFileSync(entry, "keep", "utf8");
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    fs.utimesSync(entry, old, old);
    const link = path.join(root, "ttsx-orphan");
    fs.symlinkSync(outside, link, "junction");
    pruneCacheFileRoot(link, { force: true });
    assert.equal(fs.existsSync(entry), true, "the collection followed a link");
  };

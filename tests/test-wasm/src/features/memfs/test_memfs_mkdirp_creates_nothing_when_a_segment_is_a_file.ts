import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { expectHostError, readdir } from "../../internal/callbackFs";

/**
 * Verifies MemFS mkdirp creates a whole chain or none of it, and refuses a
 * segment that is a file.
 *
 * `mkdirp` shares the ancestor walk with `writeFile` and `open` now, so it
 * validates the whole chain before creating any of it instead of creating each
 * segment as it goes. That makes the "no partial mutation" property structural
 * rather than a consequence of the tree invariant holding elsewhere, and it is
 * deliberately stricter than `mkdir -p`, which does keep the prefix it managed
 * to create. `mkdirp` had no direct case of its own before.
 *
 * 1. Create a deep chain, then repeat the same call.
 * 2. Seed a file at `/blocked` and call `mkdirp` below it and onto it.
 * 3. Assert both rejections are `ENOTDIR`, no directory was created, and the file
 *    still holds its bytes.
 */
export const test_memfs_mkdirp_creates_nothing_when_a_segment_is_a_file =
  async (): Promise<void> => {
    const host = createMemFS();

    // Positive: an ordinary deep chain, and a repeat call, both succeed.
    host.mkdirp("/deep/a/b");
    host.mkdirp("/deep/a/b");
    TestValidator.equals(
      "mkdirp creates the whole chain and is idempotent",
      {
        root: await readdir(host.fs, "/deep"),
        nested: await readdir(host.fs, "/deep/a"),
        leaf: await readdir(host.fs, "/deep/a/b"),
      },
      { root: ["a"], nested: ["b"], leaf: [] },
    );

    host.writeFile("/blocked", "FILE");
    const codes = {
      belowFile: expectHostError(() => host.mkdirp("/blocked/a/b")),
      ontoFile: expectHostError(() => host.mkdirp("/blocked")),
      normalizedAlias: expectHostError(() =>
        host.mkdirp("/deep/..//blocked/a"),
      ),
    };
    TestValidator.equals("rejection codes", codes, {
      belowFile: "ENOTDIR",
      ontoFile: "ENOTDIR",
      normalizedAlias: "ENOTDIR",
    });

    TestValidator.equals(
      "a rejected mkdirp leaves no directory behind",
      {
        blocked: host.readFileText("/blocked"),
        firstSegment: host.exists("/blocked/a"),
        secondSegment: host.exists("/blocked/a/b"),
        root: await readdir(host.fs, "/"),
      },
      {
        blocked: "FILE",
        firstSegment: false,
        secondSegment: false,
        root: ["blocked", "deep"],
      },
    );
  };

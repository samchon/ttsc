import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { expectHostError, readdir } from "../../internal/callbackFs";

/**
 * Verifies `host.writeFile` still creates missing parent directories but
 * refuses to create a file underneath an ancestor that is already a file.
 *
 * A file has no descendants, so `/parent/child.ts` cannot exist while `/parent`
 * is a file. The pre-fix `ensureParentDirs` only asked whether an ancestor
 * segment was present, never whether it was a directory, so the write reported
 * success and left `exists` and `readdir` disagreeing about `/parent`.
 *
 * 1. Write `/nested/deep/file.ts` and confirm the convenience parent creation
 *    still works.
 * 2. Write the file `/parent`, then attempt `/parent/child.ts` and a deeper
 *    `/parent/a/b.ts`.
 * 3. Assert both are rejected with `ENOTDIR`, no node was added, and `/parent`
 *    still holds its original bytes.
 */
export const test_memfs_write_file_rejects_a_file_valued_ancestor =
  async (): Promise<void> => {
    const host = createMemFS();

    // Positive: the documented convenience is unchanged.
    host.writeFile("/nested/deep/file.ts", "OK");
    TestValidator.equals(
      "nested write creates its parents",
      {
        file: host.readFileText("/nested/deep/file.ts"),
        parents: await readdir(host.fs, "/nested"),
      },
      { file: "OK", parents: ["deep"] },
    );

    host.writeFile("/parent", "PARENT");
    const codes = {
      directChild: expectHostError(() =>
        host.writeFile("/parent/child.ts", "X"),
      ),
      deepChild: expectHostError(() => host.writeFile("/parent/a/b.ts", "X")),
      normalizedAlias: expectHostError(() =>
        host.writeFile("/nested/../parent//child.ts", "X"),
      ),
    };
    TestValidator.equals("rejection codes", codes, {
      directChild: "ENOTDIR",
      deepChild: "ENOTDIR",
      normalizedAlias: "ENOTDIR",
    });

    TestValidator.equals(
      "no descendant or ancestor node was created",
      {
        child: host.exists("/parent/child.ts"),
        deepDir: host.exists("/parent/a"),
        parent: host.readFileText("/parent"),
      },
      { child: false, deepDir: false, parent: "PARENT" },
    );
  };

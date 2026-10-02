import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import {
  expectFsError,
  openFd,
  readdir,
  stat,
  writeFdText,
} from "../../internal/callbackFs";

const O_RDWR = 2;

/**
 * Verifies the host helpers keep stored bytes private, normalize every path
 * spelling to one file, and report stat and listing facts accurately.
 *
 * `readFile` and `writeFile` cross the boundary between caller memory and the
 * tree, and `readFileText` memoizes a decoding. A reference leaked in either
 * direction lets a caller edit stored bytes without a write, and a memoized
 * decoding that survives a content change serves text the file no longer
 * holds.
 *
 * 1. Mutate the array handed to `writeFile` and the array returned by `readFile`,
 *    and read the file again.
 * 2. Read the text, change the file through a descriptor, and read it again.
 * 3. Reach one file through dot, dot-dot, repeated-slash, backslash and
 *    over-the-root spellings, then assert `stat` and `readdir` on a file, a
 *    directory and missing or wrong-kind paths.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS copies bytes on writeFile and readFile, invalidates the cached text decoding after a descriptor write, resolves every path spelling to the same node, and reports file or directory stat and sorted listings with POSIX errors. Re-reading after mutating the caller's arrays and re-reading text after a write detect a shared buffer or stale decoding.
 * @evidence contracts/testing.md#independent-expectations The documented copy semantics and POSIX path resolution (dot and dot-dot segments, repeated separators, `..` at the root staying at the root) fix the expected names, and the authored bytes ABC and the written Z determine the expected contents. The directory and file sizes and the sorted names are literals derived from the seeded tree.
 * @evidence contracts/testing.md#distinguishing-cases Input aliasing, output aliasing, a warm decoding cache and a cold one, five equivalent spellings against one non-equivalent sibling, file and directory stats, and ENOENT and ENOTDIR listings are separate cases. A missing path and a directory read as a file both return null rather than throwing.
 * @evidence contracts/testing.md#execution-ownership test_memfs_host_helpers_isolate_bytes_and_normalize_paths calls the actual createMemFS helpers and the fs stat, readdir, open and write callbacks in the Node unit process; no installed host or filesystem is involved.
 */
export const test_memfs_host_helpers_isolate_bytes_and_normalize_paths =
  async (): Promise<void> => {
    const host = createMemFS();

    const input = new Uint8Array([65, 66, 67]);
    host.writeFile("/copy.bin", input);
    input[0] = 0;
    TestValidator.equals(
      "writeFile copies the caller's array",
      [...(host.readFile("/copy.bin") ?? [])],
      [65, 66, 67],
    );
    const output = host.readFile("/copy.bin")!;
    output[1] = 0;
    TestValidator.equals(
      "readFile returns a private copy",
      host.readFileText("/copy.bin"),
      "ABC",
    );

    TestValidator.equals(
      "text is decoded",
      host.readFileText("/copy.bin"),
      "ABC",
    );
    const fd = await openFd(host.fs, "/copy.bin", O_RDWR);
    await writeFdText(host.fs, fd, "Z", 2);
    TestValidator.equals(
      "a descriptor write invalidates the cached text",
      host.readFileText("/copy.bin"),
      "ABZ",
    );

    host.writeFile("/dir/sub/file.ts", "x");
    host.writeFile("/dir/b.ts", "1");
    host.writeFile("/dir/a.ts", "22");
    const spellings = [
      "/dir/sub/file.ts",
      "/dir/./sub/file.ts",
      "/dir/sub/../sub/file.ts",
      "//dir///sub//file.ts",
      "\\dir\\sub\\file.ts",
      "/../../dir/sub/file.ts",
    ];
    TestValidator.equals(
      "every equivalent spelling reads the same file",
      spellings.map((spelling) => host.readFileText(spelling)),
      spellings.map(() => "x"),
    );
    TestValidator.equals(
      "a sibling spelling is a different path",
      [host.exists("/dir/sub/file.tsx"), host.exists("/dir/sub")],
      [false, true],
    );
    TestValidator.equals(
      "an empty path names the root",
      [host.exists(""), host.readFile("")],
      [true, null],
    );
    TestValidator.equals(
      "a missing path and a directory read as no file",
      [
        host.readFile("/nope"),
        host.readFileText("/nope"),
        host.readFile("/dir"),
      ],
      [null, null, null],
    );

    const file = await stat(host.fs, "/dir/a.ts");
    const directory = await stat(host.fs, "/dir");
    TestValidator.equals(
      "stat tells a file from a directory",
      {
        file: [file.isFile(), file.isDirectory(), file.size],
        directory: [directory.isFile(), directory.isDirectory()],
      },
      { file: [true, false, 2], directory: [false, true] },
    );
    TestValidator.equals(
      "listings are sorted immediate names",
      await readdir(host.fs, "/dir"),
      ["a.ts", "b.ts", "sub"],
    );
    TestValidator.equals(
      "stat and listing errors carry their POSIX code",
      {
        statMissing: await expectFsError((cb) =>
          host.fs.stat("/dir/none", cb as never),
        ),
        listMissing: await expectFsError((cb) =>
          host.fs.readdir("/none", cb as never),
        ),
        listFile: await expectFsError((cb) =>
          host.fs.readdir("/dir/a.ts", cb as never),
        ),
      },
      { statMissing: "ENOENT", listMissing: "ENOENT", listFile: "ENOTDIR" },
    );
  };

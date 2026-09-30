import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { openFd, writeFdText } from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_WRONLY = 1;
const O_RDWR = 2;
const O_APPEND = 1024;

/**
 * Verifies an `O_APPEND` MemFS descriptor writes at end-of-file regardless of
 * the cursor or an explicit position, while a plain descriptor does not.
 *
 * The descriptor table never recorded the append flag, so appending was only a
 * coincidence of an implementation that could do nothing else. Once writes
 * honor the cursor, `O_APPEND` has to be retained or Go's `os.OpenFile` with
 * `O_APPEND` — which typescript-go's `AppendFile` uses — would start
 * overwriting from byte 0.
 *
 * 1. Open `abc` with `O_APPEND` and write with `position: null` and then with an
 *    explicit in-bounds position.
 * 2. Open the same file without `O_APPEND` and write at an explicit position.
 * 3. Assert both append writes landed at the end and the plain write overwrote in
 *    place.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.open retains O_APPEND so both null-position and positioned writes append, while an ordinary descriptor overwrites. Literal bytes reject cursor-based overwrites that merely resemble append on empty files.
 * @evidence contracts/testing.md#independent-expectations The advertised O_APPEND contract fixes the write location at current EOF regardless of requested offset. Starting from authored abc independently yields abcD, abcDE and zbcDE for the three writes.
 * @evidence contracts/testing.md#distinguishing-cases Append at null position and explicit zero both succeed at EOF; identical explicit zero without O_APPEND is the adjacent overwrite control. Retained append across rename is covered by descriptor-state recovery.
 * @evidence contracts/testing.md#execution-ownership test_memfs_open_append_always_writes_at_end_of_file directly calls createMemFS, openFd and writeFdText, comparing code/count and complete readFileText after each write. Its one Node unit entry owns both flag populations.
 */
export const test_memfs_open_append_always_writes_at_end_of_file =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/log.txt", "abc");

    const appendFd = await openFd(host.fs, "/log.txt", O_WRONLY | O_APPEND);
    const atCursor = await writeFdText(host.fs, appendFd, "D", null);
    TestValidator.equals(
      "a null-position append lands at the end",
      { ...atCursor, text: host.readFileText("/log.txt") },
      { code: null, n: 1, text: "abcD" },
    );

    const positioned = await writeFdText(host.fs, appendFd, "E", 0);
    TestValidator.equals(
      "an explicit position cannot pull an append back",
      { ...positioned, text: host.readFileText("/log.txt") },
      { code: null, n: 1, text: "abcDE" },
    );

    // Negative twin: the same write without O_APPEND overwrites in place.
    const plainFd = await openFd(host.fs, "/log.txt", O_RDWR);
    const overwrite = await writeFdText(host.fs, plainFd, "z", 0);
    TestValidator.equals(
      "a descriptor without O_APPEND overwrites at the offset",
      { ...overwrite, text: host.readFileText("/log.txt") },
      { code: null, n: 1, text: "zbcDE" },
    );
  };

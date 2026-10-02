import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation } from "../../internal/callbackFs";

/**
 * Verifies the virtual `pipe2` pair follows POSIX `pipe(2)` semantics: a read
 * on an empty pipe waits for a writer, end-of-file needs every writer closed,
 * and a write needs a surviving reader.
 *
 * The pair exists for direct JavaScript callers, and its queue is shared by two
 * descriptors that each carry one role. A reader that completes early or never
 * completes, an endpoint accepted for the wrong direction, or a write accepted
 * after the last reader left would let a consumer observe data that POSIX never
 * delivers.
 *
 * 1. Park a read on an empty pipe, write two bytes, and observe the parked reader
 *    complete with exactly those bytes.
 * 2. Queue more bytes than one read asks for and drain them in two reads, then
 *    close the write end and observe end-of-file as zero bytes.
 * 3. Reject a read on the write end and a write on the read end, park another
 *    reader, close the read end, and assert it fails with `EBADF` and a later
 *    write through the surviving write end reports `EPIPE`.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.pipe2 delivers queued bytes to a parked reader, splits an oversized chunk across reads, reports end-of-file only after the write end closes, and reports EPIPE after the read end closes. Literal byte strings and callback settlement observations reject an early completion, a lost remainder or a write accepted without a reader.
 * @evidence contracts/testing.md#independent-expectations POSIX pipe(2) and read(2) define blocking until data or writer close, zero bytes at end-of-file, EBADF for the wrong direction and EPIPE for a write without readers. The authored bytes HI, JKL and MN are the oracle for what each read must return, independent of the queue implementation.
 * @evidence contracts/testing.md#distinguishing-cases A reader parked before any write contrasts with a read of already queued bytes; a partial drain contrasts with a full one; an open write end (a pending read) contrasts with a closed one (end-of-file); wrong-direction reads and writes contrast with correct ones. A parked reader released by closing the read end carries the failure case.
 * @evidence contracts/testing.md#execution-ownership test_memfs_pipes_block_readers_and_signal_eof_and_broken_pipe calls the actual createMemFS pipe2, read, write and close callbacks inside the Node unit process, and owns every callback settlement and byte result. No Go runtime reaches this state, so no installed host is involved.
 */
export const test_memfs_pipes_block_readers_and_signal_eof_and_broken_pipe =
  async (): Promise<void> => {
    const host = createMemFS();
    const open = (): Promise<[number, number]> =>
      new Promise((resolve, reject) =>
        host.fs.pipe2(0, (err, fds) =>
          err ? reject(err) : resolve([fds[0]!, fds[1]!]),
        ),
      );
    const write = (
      fd: number,
      text: string,
    ): Promise<{ code: string | null; n: number }> =>
      new Promise((resolve) => {
        const bytes = new TextEncoder().encode(text);
        host.fs.write(fd, bytes, 0, bytes.byteLength, null, (err, n) =>
          resolve({ code: err?.code ?? null, n }),
        );
      });
    interface IRead {
      settled: boolean;
      code: string | null;
      text: string;
      n: number;
    }
    const read = (fd: number, length: number): IRead => {
      const state: IRead = { settled: false, code: null, text: "", n: -1 };
      const buffer = new Uint8Array(length);
      host.fs.read(fd, buffer, 0, length, null, (err, n) => {
        state.settled = true;
        state.code = err?.code ?? null;
        state.n = n;
        state.text = new TextDecoder().decode(buffer.subarray(0, n));
      });
      return state;
    };

    const [readFd, writeFd] = await open();
    TestValidator.predicate(
      "the two ends are distinct descriptors",
      readFd !== writeFd,
    );

    const parked = read(readFd, 8);
    TestValidator.equals(
      "a read on an empty pipe waits",
      parked.settled,
      false,
    );
    TestValidator.equals(
      "a write reports its byte count",
      await write(writeFd, "HI"),
      { code: null, n: 2 },
    );
    TestValidator.equals(
      "the write completes the parked reader with exactly its bytes",
      { settled: parked.settled, code: parked.code, text: parked.text },
      { settled: true, code: null, text: "HI" },
    );

    await write(writeFd, "JKL");
    await write(writeFd, "MN");
    const first = read(readFd, 2);
    const second = read(readFd, 8);
    TestValidator.equals(
      "an oversized chunk is split without losing the remainder",
      { first: first.text, second: second.text },
      { first: "JK", second: "LMN" },
    );
    const empty = read(readFd, 0);
    TestValidator.equals(
      "a zero-length read completes with zero bytes",
      { settled: empty.settled, n: empty.n },
      { settled: true, n: 0 },
    );

    const waiting = read(readFd, 4);
    TestValidator.equals("an empty pipe blocks again", waiting.settled, false);
    await callMutation((cb) => host.fs.close(writeFd, cb));
    TestValidator.equals(
      "closing the write end completes a parked reader at end-of-file",
      { settled: waiting.settled, code: waiting.code, n: waiting.n },
      { settled: true, code: null, n: 0 },
    );
    const afterEof = read(readFd, 4);
    TestValidator.equals(
      "a later read still sees end-of-file",
      { settled: afterEof.settled, n: afterEof.n },
      { settled: true, n: 0 },
    );

    const [reader, writer] = await open();
    const wrongRead = read(writer, 1);
    TestValidator.equals(
      "the write end refuses reads",
      { settled: wrongRead.settled, code: wrongRead.code },
      { settled: true, code: "EBADF" },
    );
    TestValidator.equals(
      "the read end refuses writes",
      await write(reader, "X"),
      { code: "EBADF", n: 0 },
    );
    const stranded = read(reader, 4);
    await callMutation((cb) => host.fs.close(reader, cb));
    TestValidator.equals(
      "closing the read end fails a parked reader",
      { settled: stranded.settled, code: stranded.code, n: stranded.n },
      { settled: true, code: "EBADF", n: 0 },
    );
    TestValidator.equals(
      "a write without a reader is a broken pipe",
      await write(writer, "Y"),
      { code: "EPIPE", n: 0 },
    );
  };

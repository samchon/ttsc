import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation } from "../../internal/callbackFs";

/**
 * Verifies the fd 1 capture decodes UTF-8 across write boundaries, flushes an
 * unfinished character when the descriptor closes, and forgets everything on
 * reset.
 *
 * The Go runtime writes its output in arbitrary byte chunks, so a multi-byte
 * character may arrive split across calls. The capture owns one streaming
 * decoder per stream: decoding each chunk independently would turn a split
 * character into replacement characters, and keeping the decoder across a reset
 * would let a stale lead byte corrupt the next run's first character.
 *
 * 1. Write the three bytes of `한` as two chunks and read the capture.
 * 2. Write a lone lead byte, close fd 1, and read the flushed replacement
 *    character.
 * 3. Write a lone lead byte, reset the streams, write `ok`, and assert no stale
 *    byte survives. Reject a non-zero explicit position on fd 1 and assign the
 *    capture through its setter.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS stdout capture joins a character split across two writes into one code point, flushes a dangling lead byte as U+FFFD when fd 1 closes, drops decoder state on resetStdio, and refuses a seek on the stream. The literal captured strings reject per-chunk decoding and a decoder that survives reset.
 * @evidence contracts/testing.md#independent-expectations The UTF-8 encoding of U+D55C is the byte triple 0xED 0x95 0x9C, and the WHATWG streaming decoder contract defines when a dangling prefix becomes U+FFFD. The authored bytes and the expected strings come from that specification, not from the capture implementation.
 * @evidence contracts/testing.md#distinguishing-cases A split character, a complete character, a dangling prefix flushed by close, a dangling prefix discarded by reset, a seekable position on a stream and a buffer assigned through the setter are separate cases; the ASCII `ok` after reset is the adjacent input that must stay unaltered.
 * @evidence contracts/testing.md#execution-ownership test_memfs_stdio_capture_decodes_split_characters_and_resets calls createMemFS fs.writeSync, fs.write, fs.close and resetStdio directly in the Node unit process and owns every captured string. Only fd 1 is written because fd 2 additionally echoes to the console, which is not the behavior under test.
 */
export const test_memfs_stdio_capture_decodes_split_characters_and_resets =
  async (): Promise<void> => {
    const host = createMemFS();
    const han = [0xed, 0x95, 0x9c];

    host.fs.writeSync(1, new Uint8Array(han.slice(0, 2)));
    TestValidator.equals(
      "an incomplete character is held back",
      host.stdout.buffer,
      "",
    );
    host.fs.writeSync(1, new Uint8Array(han.slice(2)));
    TestValidator.equals(
      "the second chunk completes one character",
      host.stdout.buffer,
      "한",
    );
    TestValidator.equals(
      "an unchanged capture reads back the same text",
      host.stdout.buffer,
      "한",
    );

    host.fs.writeSync(1, new Uint8Array([0xed]));
    await callMutation((cb) => host.fs.close(1, cb));
    TestValidator.equals(
      "closing fd 1 flushes the dangling lead byte",
      host.stdout.buffer,
      "한�",
    );

    host.resetStdio();
    host.fs.writeSync(1, new Uint8Array([0xed]));
    host.resetStdio();
    host.fs.writeSync(1, new TextEncoder().encode("ok"));
    TestValidator.equals(
      "reset drops both the text and the pending lead byte",
      host.stdout.buffer,
      "ok",
    );

    const seek = await new Promise<{ code: string | null; n: number }>(
      (resolve) => {
        const bytes = new TextEncoder().encode("Z");
        host.fs.write(1, bytes, 0, 1, 5, (err, n) =>
          resolve({ code: err?.code ?? null, n }),
        );
      },
    );
    TestValidator.equals("a stream refuses a non-zero position", seek, {
      code: "ESPIPE",
      n: 0,
    });
    TestValidator.equals(
      "the refused write captured nothing",
      host.stdout.buffer,
      "ok",
    );

    host.stdout.buffer = "seed";
    host.fs.writeSync(1, new TextEncoder().encode("+more"));
    TestValidator.equals(
      "an assigned capture continues from its value",
      host.stdout.buffer,
      "seed+more",
    );
  };

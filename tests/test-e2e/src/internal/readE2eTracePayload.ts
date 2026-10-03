import fs from "node:fs";
import path from "node:path";

/**
 * Reads one actual payload reference from its paired writer invocation.
 * Returned-string metadata is not a byte capture. Buffered-only captures remain
 * bounded product-buffer observations, never proof of complete child output.
 * The coordinator must join writers and retain the trusted root before reading.
 *
 * @evidence contracts/common.md#principled-implementation Admits the existing source owners' successful byte-reference forms, requires writer/invocation-owned filename and exact recorded length, then reads the actual file bytes without JSON reconstruction.
 * @evidence contracts/common.md#clear-and-simple-design One bounded reference reader handles the three actual length/path spellings while leaving raw reply parsing and independent semantic assertions to the consuming profile.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing, failed, truncated or returned-text references throw rather than supplying an expected reply. It neither creates a payload nor reserializes product JSON as wire evidence.
 * @evidence contracts/common.md#meaningful-documentation States invocation pairing, actual reference forms, trusted after-join lifetime and the bounded-buffer observation limit.
 * @evidence contracts/portability.md#os-neutral-implementation Requires a helper-owned basename within the native trace root and rejects native links; retained byte identity does not rely on case folding or platform names.
 * @evidence contracts/performance.md#efficient-algorithms One explicit capture of at most64MiB is read into a recorded-length buffer plus a one-byte overflow check, with native metadata checks around it. Work and complete-buffer memory scale with its actual bytes, not all trace payloads.
 * @evidence contracts/performance.md#reuse-equivalent-work Each consumer reads its actual invocation reference; no parsed result or previous payload is reused for another operation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The explicitly opened descriptor closes in finally before return on success or failure; the returned Buffer transfers to the caller. Actual writer joins, trusted-root ownership and payload-file cleanup remain coordinator responsibilities.
 */
export function readE2eTracePayload(
  root: string,
  writer: { writerPid: number; instance: string; invocation: string },
  reference: unknown,
): { bytes: Buffer; bufferedOnly: boolean | undefined; file: string } {
  if (reference === null || typeof reference !== "object")
    throw new Error("Missing actual trace payload reference");
  const metadata = reference as Record<string, unknown>;
  if (metadata.representation === "returned-string")
    throw new Error("Returned text is not an original byte capture");
  const successful = (metadata.capture === undefined || metadata.capture === "complete") &&
    (metadata.outcome === undefined || metadata.outcome === "complete") &&
    (metadata.capture === "complete" || metadata.outcome === "complete" || typeof metadata.bytes === "number");
  if (!successful) throw new Error("Trace payload capture did not complete");
  const name = metadata.path ?? metadata.relativePath;
  const length = metadata.observedByteLength ?? metadata.observedBytes ?? metadata.length ?? metadata.bytes;
  const ordinal = writer.invocation.slice(writer.instance.length + 1);
  if (!Number.isSafeInteger(writer.writerPid) || writer.writerPid <= 0 ||
    !writer.invocation.startsWith(writer.instance + ":") || !/^\d+$/.test(ordinal) ||
    typeof name !== "string" || name !== path.basename(name) || name.includes("/") || name.includes("\\") ||
    !name.startsWith(`${writer.writerPid}-${writer.instance}-${ordinal}-`) || !name.endsWith(".bin") ||
    typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > 64 * 1024 * 1024)
    throw new Error("Invalid writer-owned trace payload identity or length");
  if (!path.isAbsolute(root)) throw new Error("Trace payload root must be absolute");
  const file = path.join(root, name);
  const before = fs.lstatSync(file, { bigint: true });
  if (!before.isFile() || before.size !== BigInt(length))
    throw new Error("Trace payload native file/length mismatch");
  const bytes = Buffer.alloc(length);
  const fd = fs.openSync(file, "r");
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size)
      throw new Error("Trace payload owner changed before read");
    let offset = 0;
    while (offset < length) {
      const read = fs.readSync(fd, bytes, offset, length - offset, offset);
      if (read === 0) throw new Error("Trace payload ended before its recorded length");
      offset += read;
    }
    if (fs.readSync(fd, Buffer.alloc(1), 0, 1, length) !== 0)
      throw new Error("Trace payload exceeded its recorded length");
    const after = fs.fstatSync(fd, { bigint: true });
    const pathAfter = fs.lstatSync(file, { bigint: true });
    if (!pathAfter.isFile() || pathAfter.dev !== after.dev || pathAfter.ino !== after.ino ||
      before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs)
      throw new Error("Trace payload changed during observation");
  } finally {
    fs.closeSync(fd);
  }
  return { bytes, file, bufferedOnly: typeof metadata.bufferedOnly === "boolean" ? metadata.bufferedOnly : undefined };
}

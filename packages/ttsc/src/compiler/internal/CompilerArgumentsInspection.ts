import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

import { readCompilerOptionOccurrence } from "../../flags/readCompilerOptionOccurrence";

/**
 * Inspect compiler argument frames without replacing the emitting producer.
 * Response identity and content are observed; native occurrence widths keep
 * dash and @ operands with their options. Unknown or incomplete inspection
 * requests fail before a reporting flag can become a missing scalar value.
 *
 * @evidence contracts/common.md#principled-implementation Shared native occurrence widths preserve option operands and response-frame boundaries; bracketed physical metadata and hashes establish observations without inventing compiler ownership.
 * @evidence contracts/common.md#clear-and-simple-design The namespace owns argument inspection and its file observation representation; callers retain executable selection, native validation and emission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing native response tokenization and metadata are retained, with generated occurrence consumption rather than independent option arity guesses or foreign method replacement.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains refusal, observation limits and producer ownership; members document transferred response observations and physical file signatures.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The grouping owns no independent native representation; its inspection and observation members describe their filesystem boundaries.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The grouping has no independent computation; the selected members own scans and hashing.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work No namespace cache or shared task is retained.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Invocation-local inspection and synchronous file operations have member owners.
 */
export namespace CompilerArgumentsInspection {
  /**
   * Expand observed response frames while preserving native operand positions.
   * Throws when read-only reporting cannot safely extend the original frame.
   * The producer still receives the caller's original argv and owns diagnostics.
   *
   * @evidence contracts/common.md#principled-implementation A stack preserves each response frame and occurrence widths skip scalar operands; bare booleans receive an explicit value only in the inspection projection so parent tokens cannot bind across frames.
   * @evidence contracts/common.md#clear-and-simple-design One cursor per frame and one active physical-path set distinguish ordered reuse from cycles, returning projected argv and the observations needed by the emission owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This is conservative inspection admission, not a second native option validator; unknown or unsafe frames throw without rewriting the actual producer request.
   * @evidence contracts/common.md#meaningful-documentation The comment describes projected argv, refusal and retained native diagnostic ownership.
   * @evidence contracts/portability.md#os-neutral-implementation Native real paths and bigint file metadata identify response files; UTF-8 and BOM-selected UTF-16 decoding preserve the existing native filesystem text boundary.
   * @evidence contracts/performance.md#efficient-algorithms Each frame token is visited once and each response read is hashed; time follows expanded token/text bytes and observed file bytes, with stack and output space proportional to the expanded invocation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Response files are reread for each invocation because bytes and identity may change; no earlier request establishes continued validity.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous reads retain no handles; active paths leave the set as frames close, and projected arguments and observations transfer to the caller.
   */
  export function inspect(args: readonly string[], cwd: string) {
    const observations = new Map<string, string>();
    const projected: string[] = [];
    const active = new Set<string>();
    const frames: {
      args: readonly string[];
      index: number;
      physical?: string;
    }[] = [{ args, index: 0 }];
    while (frames.length !== 0) {
      const frame = frames[frames.length - 1]!;
      if (frame.index === frame.args.length) {
        if (frame.physical !== undefined) active.delete(frame.physical);
        frames.pop();
        continue;
      }
      const index = frame.index;
      const token = frame.args[index]!;
      if (token.startsWith("@")) {
        frame.index++;
        const file = path.resolve(cwd, token.slice(1));
        const before = observeInputFile(file);
        const physical = (JSON.parse(before) as [string])[0];
        if (active.has(physical))
          throw new Error(`Cyclic compiler response file: ${file}`);
        const text = responseText(fs.readFileSync(file));
        if (observeInputFile(file) !== before)
          throw new Error(
            `Compiler response file changed during reading: ${file}`,
          );
        const previous = observations.get(file);
        if (previous !== undefined && previous !== before)
          throw new Error(
            `Compiler response file changed between reads: ${file}`,
          );
        observations.set(file, before);
        active.add(physical);
        frames.push({ args: responseTokens(text), index: 0, physical });
        continue;
      }
      const occurrence = readCompilerOptionOccurrence(frame.args, index);
      if (token.startsWith("-")) {
        const option = occurrence.option;
        if (
          option === undefined ||
          token.includes("=") ||
          (option.kind !== "boolean" &&
            option.kind !== "list" &&
            occurrence.width === 1) ||
          (option.kind === "boolean" && occurrence.booleanValue === undefined)
        )
          throw new Error(
            `Unsupported or incomplete compiler inspection option: ${token}`,
          );
      }
      projected.push(...frame.args.slice(index, index + occurrence.width));
      if (occurrence.option?.kind === "boolean" && occurrence.width === 1)
        projected.push(occurrence.booleanValue === true ? "true" : "false");
      frame.index += occurrence.width;
    }
    return { args: projected, observations };
  }

  /**
   * Bracket a regular file read with physical identity and bigint metadata.
   * Executable cross-command observations omit ctime; source observations keep
   * it. A change restored between observations can remain invisible.
   *
   * @evidence contracts/common.md#principled-implementation Real paths, object metadata and SHA256 bytes describe the actual observed file; before/after equality rejects an unstable read, with executable ctime omitted only from the returned cross-command signature.
   * @evidence contracts/common.md#clear-and-simple-design One serialized signature is shared by source, executable and response observation consumers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No path spelling, same-stem output or version label substitutes for observed physical identity and bytes; the documented gap is not claimed atomic.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains metadata bracketing, executable ctime and the observation gap.
   * @evidence contracts/portability.md#os-neutral-implementation Native realpath and bigint stat values represent physical objects without assuming platform case policy or inode precision in JavaScript numbers.
   * @evidence contracts/performance.md#efficient-algorithms One file read and hash are linear in its bytes, with constant metadata comparisons and a transient buffer of that file's size.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A current observation cannot reuse earlier bytes without validating the same current identity and contents; no history is cached here.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous readFile and stat operations retain no open handle; the signature transfers to its caller.
   */
  export function observeInputFile(
    source: string,
    kind: "source" | "executable" = "source",
  ): string {
    const physical = fs.realpathSync.native(source);
    const before = fs.statSync(source, { bigint: true });
    if (!before.isFile())
      throw new Error("Observed compiler input is not a regular file.");
    const hash = createHash("sha256")
      .update(fs.readFileSync(source))
      .digest("hex");
    const after = fs.statSync(source, { bigint: true });
    const fullSignature = (stat: fs.BigIntStats) =>
      [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
    if (
      fullSignature(before) !== fullSignature(after) ||
      fs.realpathSync.native(source) !== physical
    )
      throw new Error("Compiler input changed during observation.");
    const signature =
      kind === "source"
        ? fullSignature(after)
        : [after.dev, after.ino, after.size, after.mtimeNs].join(":");
    return JSON.stringify([physical, signature, hash]);
  }
}

/** Native filesystem decoding strips UTF-8/UTF-16 BOMs before tokenization. */
function responseText(bytes: Buffer): string {
  if (bytes.length >= 2) {
    const littleEndian = bytes[0] === 0xff && bytes[1] === 0xfe;
    const bigEndian = bytes[0] === 0xfe && bytes[1] === 0xff;
    if (littleEndian || bigEndian) {
      if (bytes.length % 2 !== 0)
        throw new Error("Incomplete UTF-16 compiler response text.");
      return new TextDecoder(littleEndian ? "utf-16le" : "utf-16be", {
        ignoreBOM: true,
      }).decode(bytes.subarray(2));
    }
  }
  const start =
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  return bytes.subarray(start).toString("utf8");
}

/** Native response grammar: ASCII control/space separators and whole quotes. */
function responseTokens(text: string): string[] {
  const args: string[] = [];
  let position = 0;
  while (position < text.length) {
    while (position < text.length && text.charCodeAt(position) <= 32)
      position++;
    if (position === text.length) break;
    if (text[position] === '"') {
      const end = text.indexOf('"', position + 1);
      if (end === -1) throw new Error("Unterminated compiler response quote.");
      args.push(text.slice(position + 1, end));
      position = end + 1;
    } else {
      const start = position;
      while (position < text.length && text.charCodeAt(position) > 32)
        position++;
      args.push(text.slice(start, position));
    }
  }
  return args;
}

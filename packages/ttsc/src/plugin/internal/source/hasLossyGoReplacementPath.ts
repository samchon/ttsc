import { isUtf8 } from "node:buffer";

/**
 * Detect bytes a Go replacement target loses when Go serializes it to JSON.
 * Call after Go accepts the manifest and reports a local path containing
 * U+FFFD.
 *
 * @evidence contracts/common.md#principled-implementation Inspects the original bytes of tokens following replacement arrows, including the byte escapes Go unquotes before JSON serialization.
 * @evidence contracts/common.md#clear-and-simple-design This lexical check only detects a lossy path; Go still owns manifest parsing and reports the directives.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Comments, quoted text and escaped backslashes cannot stand in for raw path bytes. Valid UTF-8 encoded as byte escapes passes the same check as literal UTF-8.
 * @evidence contracts/common.md#meaningful-documentation Identifies the precondition and the JSON boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Operates on manifest bytes without assuming a native pathname encoding.
 * @evidence contracts/performance.md#efficient-algorithms Scans a byte-preserving string once and decodes only the target tokens.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The manifest reader owns syntax reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources All token data is call-local and no native resource is acquired.
 */
export function hasLossyGoReplacementPath(bytes: Buffer): boolean {
  const tokens =
    /\/\/[^\n]*|"(?:\\[^\n]|[^"\\\n])*"|[()[\]{},\n]|(?:(?!\/\/)[^ \t\r\n()[\]{},"])+/g;
  let followsArrow = false;
  for (const [token] of bytes.toString("latin1").matchAll(tokens)) {
    if (followsArrow) {
      const value = token.startsWith('"')
        ? token
            .slice(1, -1)
            .replace(/\\(?:x[0-9a-fA-F]{2}|[0-7]{3}|.)/g, (escape) => {
              if (escape[1] === "x")
                return String.fromCharCode(
                  Number.parseInt(escape.slice(2), 16),
                );
              if (escape.length === 4)
                return String.fromCharCode(Number.parseInt(escape.slice(1), 8));
              // The other valid Go escapes emit ASCII or a Unicode scalar.
              // Neither can complete a UTF-8 sequence interrupted by the escape.
              return "\0";
            })
        : token;
      if (!isUtf8(Buffer.from(value, "latin1"))) return true;
    }
    followsArrow = token === "=>";
  }
  return false;
}

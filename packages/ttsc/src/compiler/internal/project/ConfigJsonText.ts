/**
 * Text handling shared by the strict JSON and the JSONC config readers.
 *
 * Both readers must report a failure the same way and must treat a leading
 * byte-order mark the same way, or a `package.json` and a `tsconfig.json` saved
 * by the same editor would be accepted by one reader and rejected by the
 * other.
 */
export namespace ConfigJsonText {
  /** Render a parse failure's message without the `Error:` noise around it. */
  export function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Replace a leading UTF-8 BOM with a space. JSON ignores leading whitespace,
   * so blanking rather than removing keeps every later offset equal to the
   * offset in the original file. A BOM anywhere else is left in place and still
   * rejected, which is the behaviour issue #216 pinned.
   */
  export function stripLeadingBom(input: string): string {
    return input.charCodeAt(0) === 0xfeff ? ` ${input.slice(1)}` : input;
  }
}

import assert from "node:assert/strict";

/** Shared expectations for the `@ttsc/banner` E2E experiment. */
export namespace TestBanner {
  /** Text of `fixtures/banner/workspace/shared/banner.config.cjs`. */
  export const SHARED_TEXT = "Copyright\nMIT License\nthird line\nfourth line";

  /**
   * Asserts that `output` contains the banner preamble for `text` exactly once.
   * Duplicates would indicate the banner was injected by both the tsconfig
   * plugin entry and the auto-discovery path.
   */
  export function assertSingleBanner(output: string, text: string): void {
    const banner = bannerPreamble(text);
    const count = output.split(banner).length - 1;
    assert.equal(
      count,
      1,
      `expected one ${JSON.stringify(text)} banner, got ${count}`,
    );
  }

  /**
   * Builds the expected `@packageDocumentation` JSDoc block that the banner
   * plugin emits at the top of each output file. Trailing blank lines are
   * stripped and `* /` escaping is applied to any `* /` sequences in `text`.
   */
  export function bannerPreamble(text: string): string {
    const lines = text.split(/\r?\n/).filter((line, index, all) => {
      return index < all.length - 1 || line.trim() !== "";
    });
    const sep = "-".repeat(64);
    return [
      "/**",
      ` * ${sep}`,
      ...lines.map((line) => ` * ${line.replaceAll("*/", "* /")}`),
      " *",
      " * @packageDocumentation",
      " */",
    ]
      .join("\n")
      .concat("\n");
  }
}

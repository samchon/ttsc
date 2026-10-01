import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Shared helpers for the `@ttsc/banner` feature-test suite. */
export namespace TestBanner {
  const PACKAGE_NAME = "banner";

  /**
   * Symlinks `packages/banner` into `<root>/node_modules/@ttsc/banner` so that
   * the real plugin package is resolvable from the temporary project without a
   * full install.
   */
  export function seedPackage(root: string): void {
    const linkDir = path.join(root, "node_modules", "@ttsc");
    fs.mkdirSync(linkDir, { recursive: true });
    const target = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      PACKAGE_NAME,
    );
    const link = path.join(linkDir, PACKAGE_NAME);
    try {
      fs.symlinkSync(target, link, "junction");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }

  /**
   * Returns a `PATH` string that prepends the local Go SDK bin directory when
   * it exists (`~/go-sdk/go/bin`), falling back to the current `PATH`. Required
   * so Go-compiled plugin binaries can be located at test time on developer
   * machines that install Go to the non-standard location.
   */
  export function goPath(): string | undefined {
    const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
    return fs.existsSync(localGo)
      ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
      : process.env.PATH;
  }

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

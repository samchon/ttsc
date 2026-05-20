/**
 * Shared test helpers for utility-plugin feature tests. Provides fixture setup
 * (node_modules symlinks, factory contexts) and assertion utilities (banner
 * content checks) used across the utility-plugins feature suite.
 */
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export namespace TestUtilityPlugins {
  const UTILITY_PACKAGES = ["lint", "banner", "paths", "strip"] as const;

  /**
   * Builds a minimal plugin factory context pointing at the workspace root,
   * suitable for invoking `createTtscPlugin` exported by each utility package.
   */
  export function factoryContext(name: string) {
    return {
      binary: "",
      cwd: TestProject.WORKSPACE_ROOT,
      plugin: { transform: `@ttsc/${name}` },
      projectRoot: TestProject.WORKSPACE_ROOT,
      tsconfig: path.join(TestProject.WORKSPACE_ROOT, "tsconfig.json"),
    };
  }

  /**
   * Creates `node_modules/@ttsc/<name>` symlinks inside `root` pointing at the
   * workspace package directories. Silently ignores `EEXIST` so the helper is
   * idempotent across repeated calls in the same temp directory.
   */
  export function seedPackages(
    root: string,
    names: readonly string[] = UTILITY_PACKAGES,
  ): void {
    const linkDir = path.join(root, "node_modules", "@ttsc");
    fs.mkdirSync(linkDir, { recursive: true });
    for (const name of names) {
      const target = path.join(TestProject.WORKSPACE_ROOT, "packages", name);
      const link = path.join(linkDir, name);
      try {
        fs.symlinkSync(target, link, "junction");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      }
    }
  }

  /**
   * Returns a PATH string that prepends `~/go-sdk/go/bin` when that directory
   * exists, falling back to `process.env.PATH` otherwise. Used when spawning
   * ttsc so the Go toolchain is found in environments that install it locally.
   */
  export function goPath(): string | undefined {
    const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
    return fs.existsSync(localGo)
      ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
      : process.env.PATH;
  }

  /**
   * Asserts that the banner preamble for `text` appears exactly once in
   * `output`. Fails with a message showing the actual count if it appears zero
   * or more than once.
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
   * Renders the `@ttsc/banner` preamble comment block for the given banner
   * text. Matches the exact format that the banner plugin emits, including the
   * 64-dash separator and `@packageDocumentation` tag, so tests can search
   * emitted output without reimplementing the rendering logic.
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

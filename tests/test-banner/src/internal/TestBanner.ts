import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export namespace TestBanner {
  const PACKAGE_NAME = "banner";

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

  export function goPath(): string | undefined {
    const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
    return fs.existsSync(localGo)
      ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
      : process.env.PATH;
  }

  export function assertSingleBanner(output: string, text: string): void {
    const banner = bannerPreamble(text);
    const count = output.split(banner).length - 1;
    assert.equal(
      count,
      1,
      `expected one ${JSON.stringify(text)} banner, got ${count}`,
    );
  }

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

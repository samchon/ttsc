import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { workspaceRoot } from "@ttsc/testing";

const utilityPackages = ["lint", "banner", "paths", "strip"] as const;

function factoryContext(name: string) {
  return {
    binary: "",
    cwd: workspaceRoot,
    plugin: { transform: `@ttsc/${name}` },
    projectRoot: workspaceRoot,
    tsconfig: path.join(workspaceRoot, "tsconfig.json"),
  };
}

function seedUtilityPackages(
  root: string,
  names: readonly string[] = utilityPackages,
): void {
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  for (const name of names) {
    const target = path.join(workspaceRoot, "packages", name);
    const link = path.join(linkDir, name);
    try {
      fs.symlinkSync(target, link, "junction");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }
}

function goPath(): string | undefined {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

function assertSingleBanner(output: string, text: string): void {
  const banner = bannerPreamble(text);
  const count = output.split(banner).length - 1;
  assert.equal(
    count,
    1,
    `expected one ${JSON.stringify(text)} banner, got ${count}`,
  );
}

function bannerPreamble(text: string): string {
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

export const TestUtilityPlugins = {
  assertSingleBanner,
  bannerPreamble,
  factoryContext,
  goPath,
  packages: utilityPackages,
  seedUtilityPackages,
};

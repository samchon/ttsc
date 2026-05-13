import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export namespace TestStrip {
  const PACKAGE_NAME = "strip";

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
}

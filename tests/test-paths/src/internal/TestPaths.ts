import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Shared helpers for the `@ttsc/paths` feature-test suite. */
export namespace TestPaths {
  const PACKAGE_NAME = "paths";

  /**
   * Symlinks `packages/paths` into `<root>/node_modules/@ttsc/paths` so that
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
}

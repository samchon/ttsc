import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx compiles an installed package's root without creating anything
 * in the package's directory, even transiently.
 *
 * A root no build covered is compiled through a tsconfig ttsx synthesizes to
 * inherit the owning project's options. For an installed package that build is
 * emit-only and runs while the program is running, so its tsconfig lives in
 * ttsx's private directory: a package directory may be read-only, and a file
 * created and removed there still changes the directory's metadata, which is
 * how a plugin descriptor's missing resolution candidates are fingerprinted.
 * The directory's modification time records any entry that came and went.
 *
 * 1. Install a package whose `main` is a root its own `include` omits.
 * 2. Record the package directory's modification time and entries.
 * 3. Run a consumer entry that requires the package.
 * 4. Assert the program ran and the directory is exactly as it was.
 */
export const test_ttsx_compiles_an_installed_package_root_without_writing_into_the_package =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "consumer", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `declare const require: (id: string) => { value: string };`,
        `console.log(require("root-pkg").value);`,
        `export {};`,
        ``,
      ].join("\n"),
      "node_modules/root-pkg/package.json": JSON.stringify({
        name: "root-pkg",
        version: "1.0.0",
        main: "index.ts",
      }),
      "node_modules/root-pkg/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          types: [],
        },
        include: ["src"],
      }),
      "node_modules/root-pkg/src/inside.ts": `export const inside: string = "inside";\n`,
      "node_modules/root-pkg/index.ts": `export const value: string = "root-ran";\n`,
    });
    const pkg = path.join(root, "node_modules", "root-pkg");
    const before = snapshot(pkg);

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "root-ran");
    assert.deepEqual(snapshot(pkg), before);
  };

/** The directory's modification time and its sorted entry names. */
function snapshot(directory: string): { entries: string[]; mtimeNs: bigint } {
  return {
    entries: fs.readdirSync(directory).sort(),
    mtimeNs: fs.statSync(directory, { bigint: true }).mtimeNs,
  };
}

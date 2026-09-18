import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TTSX_REGISTER, linkTtscPackage } from "../../internal/ttsx-register";

/**
 * Verifies a ttsx run leaves every compiler output the project declares
 * byte-identical: declarations, build information, and JavaScript.
 *
 * Pins samchon/ttsc#1404. ttsx compiles into a private per-run directory, but
 * only `outDir` was redirected there. `declarationDir` and `tsBuildInfoFile`
 * name their own locations, so a run wrote `.d.ts` files into the published
 * types directory, including one for a script the project keeps out of its file
 * set, and replaced the incremental build information with its private build's
 * state. Every build ttsx starts now isolates all of its outputs.
 *
 * 1. Create a project with `declaration`, `declarationDir`, `incremental`, and
 *    `tsBuildInfoFile`, plus `scripts/tool.ts` outside `include`, and build it
 *    with ttsc.
 * 2. Run the in-include entry and the out-of-include script through ttsx, and the
 *    entry through the `ttsc/register` preload.
 * 3. Assert each run succeeds and the project tree outside `node_modules` is
 *    byte-identical to the state after the ttsc build.
 */
export const test_ttsx_leaves_declaration_and_build_info_outputs_untouched =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "side-products", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          rootDir: "src",
          declaration: true,
          declarationDir: "types",
          incremental: true,
          tsBuildInfoFile: "build/app.tsbuildinfo",
          types: [],
        },
        include: ["src"],
      }),
      "src/index.ts": `export const value: string = "entry";\nconsole.log(value);\n`,
      "scripts/tool.ts": `export const tool: string = "tool";\nconsole.log(tool);\n`,
    });
    linkTtscPackage(root);

    const built = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "-p", "tsconfig.json"],
      { cwd: root },
    );
    assert.equal(built.status, 0, built.stderr);
    const before = snapshot(root);
    assert.ok(before.has("types/index.d.ts"), [...before.keys()].join("\n"));
    assert.ok(before.has("build/app.tsbuildinfo"));

    for (const [label, command, args, expected] of [
      ["entry", TestProject.TTSX_BIN, ["--cwd", root, "src/index.ts"], "entry"],
      [
        "script",
        TestProject.TTSX_BIN,
        ["--cwd", root, "scripts/tool.ts"],
        "tool",
      ],
      [
        "register",
        process.execPath,
        ["--require", TTSX_REGISTER, "src/index.ts"],
        "entry",
      ],
    ] as const) {
      const result = TestProject.spawn(command, [...args], { cwd: root });
      assert.equal(result.status, 0, `${label}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), expected, label);
      assert.deepEqual(snapshot(root), before, `${label} changed the project`);
    }
  };

/** Every file outside `node_modules`, keyed by `/` path, to its SHA-256. */
function snapshot(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(location);
      else
        files.set(
          path.relative(root, location).split(path.sep).join("/"),
          crypto
            .createHash("sha256")
            .update(fs.readFileSync(location))
            .digest("hex"),
        );
    }
  };
  walk(root);
  return files;
}

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TTSX_REGISTER, linkTtscPackage } from "../../internal/ttsx-register";

/**
 * Verifies ttsx type-checks a required source that no checked build covered,
 * and stops before that source runs when the check fails.
 *
 * The entry build is ttsx's type gate, but it only covers the program the
 * compiler saw. A `require` of a file outside `include` reaches code that
 * program never contained, so without a check of its own the file would run
 * unchecked — or, before samchon/ttsc#1382, as another file's emit. Such a file
 * is a root, and every root is checked through its owning project, the same
 * gate `ttsc/register` applies at a JavaScript-to-TypeScript boundary. Its
 * negative twin is the installed-package case, which stays emit-only.
 *
 * 1. Create a project with `include: ["src"]` whose entry requires
 *    `tools/effect.ts`, a file with a type error and a filesystem side effect.
 * 2. Run the entry through ttsx and through the `ttsc/register` preload.
 * 3. Assert both runs fail naming the file and the diagnostic, that the side
 *    effect never happened, and that no synthesized tsconfig was left behind.
 */
export const test_ttsx_stops_on_a_type_error_in_a_required_source_no_checked_build_covered =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "gated-root", private: true }),
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
        `declare const require: (path: string) => unknown;`,
        `console.log("entry ran");`,
        `require("../tools/effect.ts");`,
        `export {};`,
        ``,
      ].join("\n"),
      "tools/effect.ts": [
        `declare const require: (id: "node:fs") => {`,
        `  writeFileSync(file: string, text: string): void;`,
        `};`,
        `declare const process: { env: Record<string, string | undefined> };`,
        `const count: number = "not a number";`,
        `require("node:fs").writeFileSync(process.env.TTSX_ROOT_MARKER!, String(count));`,
        `export {};`,
        ``,
      ].join("\n"),
    });
    linkTtscPackage(root);
    const marker = path.join(root, "effect-ran.txt");

    for (const [lane, command, args] of [
      ["ttsx", TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"]],
      [
        "register",
        process.execPath,
        ["--require", TTSX_REGISTER, "src/main.ts"],
      ],
    ] as const) {
      const result = TestProject.spawn(command, [...args], {
        cwd: root,
        env: { TTSX_ROOT_MARKER: marker },
      });
      assert.notEqual(result.status, 0, `${lane}: ${result.stdout}`);
      assert.match(result.stderr, /root check failed for .*effect\.ts/);
      assert.match(
        result.stderr,
        /Type 'string' is not assignable to type 'number'/,
      );
      assert.equal(fs.existsSync(marker), false, `${lane} ran the root`);
    }

    assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith(".ttsx-")),
      [],
    );
  };

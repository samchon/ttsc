import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies orphan decorator lowering executes the requested source.
 *
 * A full compilation also emits imports outside node_modules. Two index.ts
 * files can make a basename lookup silently skip the decorated entry.
 *
 * 1. Dynamically import an excluded script that imports another index.ts.
 * 2. Decorate a class only in the requested script.
 * 3. Assert its decorator effects and exports both execute.
 */
export const test_ttsx_standard_decorators_in_orphans_keep_the_requested_source =
  () => {
    const root = TestProject.createProject({
      "package.json": '{"type":"module"}',
      "tsconfig.json": TestProject.tsconfig({
        target: "ES2022",
        module: "esnext",
        rootDir: "src",
        outDir: "dist",
      }),
      "src/main.ts":
        'const name: string = "../scripts/index.ts"; const dep = await import(name); console.log(dep.answer, dep.own); export {};',
      "scripts/index.ts":
        'import { answer } from "./internal/index";\n' +
        STANDARD_DECORATOR_SOURCE +
        "\nexport { answer }; export const own = 1;",
      "scripts/internal/index.ts": "export const answer = 42;",
    });
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT + "\n42 1");
  };

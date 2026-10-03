import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../../internal/ttsc/internal/ttsx-decorators";

/**
 * Verifies orphan decorator lowering executes the requested source.
 *
 * A full compilation also emits imports outside node_modules. Two index.ts
 * files can make a basename lookup silently skip the decorated entry.
 *
 * 1. Dynamically import an excluded script that imports another index.ts.
 * 2. Decorate a class only in the requested script.
 * 3. Assert its decorator effects and exports both execute.
 * @evidence contracts/testing.md#behavioral-verification Actual dynamic import of an excluded decorated index.ts with a same-name helper must execute complete effects and exports 42 1, detecting basename output misselection.
 * @evidence contracts/testing.md#independent-expectations Helper answer 42, requested own 1 and the fixture decorator log are authored independently of emitted-name lookup.
 * @evidence contracts/testing.md#distinguishing-cases Excluded requested source decorates while imported same-name helper provides a value; general included/excluded ownership has another batch.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns one launcher and dynamic orphan import.
 * @evidence contracts/e2e.md#necessary-boundary Isolated emit can contain multiple same-basename outputs; actual Node loading must select the requested full source. Synthetic maps cannot certify native mapping.
 * @evidence contracts/e2e.md#shared-execution One root/orphan preparation and host serve both identities in the same import graph.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Distinct immutable full paths prevent basename aliasing; completed host precedes tracked cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original zero status, complete decorator effects and both literal exports remain.
 */
export function test_ttsx_standard_decorators_in_orphans_keep_the_requested_source() {
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
  }

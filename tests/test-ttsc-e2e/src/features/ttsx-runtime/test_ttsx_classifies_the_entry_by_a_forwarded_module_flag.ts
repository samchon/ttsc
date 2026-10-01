import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx serves the entry project in the module format a forwarded
 * `--module` gave its emit.
 *
 * The runtime classifies each served file as CommonJS or an ES module by the
 * options its build emitted with. It read the config alone, so `ttsx --module
 * esnext` on a CommonJS project emitted ESM that the runtime then served as
 * CommonJS: Node's loader evaluated nothing and the run exited 0 without a line
 * of output. The forwarded flag decides the emit, so it decides the
 * classification too, for a project entry and for one outside `include`.
 *
 * A response file carries the flag as well, and the compiler expands it through
 * `--showConfig` against a tsconfig. For an entry outside `include` that
 * tsconfig must be the project's own: the synthesized one the entry was built
 * through is gone by the time the entry is classified.
 *
 * 1. Create a CommonJS project whose entry imports a sibling, an entry outside
 *    `include`, and a response file naming `--module esnext`.
 * 2. Run each entry with `--module esnext`, with `--module preserve`, and with the
 *    response file.
 * 3. Assert every run prints the imported value.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx runs both project-owned and excluded entries under forwarded esnext, preserve and a compiler response file; every request must exit zero and print its corresponding inside helped or outside helped literal.
 * @evidence contracts/testing.md#independent-expectations Authored helper and entry strings define expected values; CLI precedence over CommonJS config and response-file compiler ownership require ESM output rather than silently executing no entry.
 * @evidence contracts/testing.md#distinguishing-cases Three flag sources crossed with owned and excluded entry paths retain all six profiles, including the synthesized-config response context; direct module classification does not expand a native compiler response file.
 * @evidence contracts/testing.md#execution-ownership The named feature function owns six real compiler-backed CLI requests. The parser and RuntimeModuleFormat units own portable spelling and format decisions; this entry retains actual response and excluded-entry assembly.
 * @evidence contracts/e2e.md#necessary-boundary Forwarded options must reach actual emit metadata, including a deleted temporary excluded-entry config; returning esnext or preserve from a pure classifier cannot prove that lifetime-dependent caller connection.
 * @evidence contracts/e2e.md#shared-execution All requests reuse one fixture and response file but currently have six independent preparation/host lifetimes; config/CLI/response and excluded-entry combinations still require consolidation rather than being called one execution.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Immutable source/config/response inputs share only equivalent fixture state; each synchronous host exits before the next request, and there is no mutation invalidation or cold-cache assertion.
 * @evidence contracts/e2e.md#preserved-coverage All six original zero-status and exact output assertions remain; each request collects its labeled failure and the final AggregateError reports every still-executable profile rather than stopping at the first one.
 */
export function test_ttsx_classifies_the_entry_by_a_forwarded_module_flag() {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "moduleflag", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        types: [],
      },
      include: ["src"],
    }),
    "src/helper.ts": `export const helper = (): string => "helped";\n`,
    "src/main.ts": [
      `import { helper } from "./helper";`,
      `console.log("inside " + helper());`,
      ``,
    ].join("\n"),
    "outside.ts": [
      `import { helper } from "./src/helper";`,
      `console.log("outside " + helper());`,
      ``,
    ].join("\n"),
  });
  const responseFile = path.join(root, "module.rsp");
  fs.writeFileSync(responseFile, "--module\nesnext\n", "utf8");

  const failures: Error[] = [];
  for (const flags of [
    ["--module", "esnext"],
    ["--module", "preserve"],
    [`@${responseFile}`],
  ]) {
    for (const [entry, expected] of [
      ["src/main.ts", "inside helped"],
      ["outside.ts", "outside helped"],
    ] as const) {
      const label = `${flags.join(" ")} ${entry}`;
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, ...flags, entry],
        { cwd: root },
      );
      try {
        assert.equal(result.status, 0, `${label}: ${result.stderr}`);
        assert.equal(result.stdout.trim(), expected, label);
      } catch (error) { failures.push(new Error(label, { cause: error })); }
    }
  }
  if (failures.length) throw new AggregateError(failures, "forwarded module profiles failed");
}

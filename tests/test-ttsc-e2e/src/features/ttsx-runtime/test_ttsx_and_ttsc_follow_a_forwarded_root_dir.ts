import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx and positional `ttsc <file>` find the output of a build whose
 * `rootDir` was forwarded on the command line.
 *
 * Outputs are laid out below `rootDir`, and a `--rootDir` forwarded before the
 * entry reaches the compiler after the config's, so it is the root in effect.
 * Output lookup is proof-based since samchon/ttsc#1382: it mirrors a source
 * against the root the compiler used, and against the config's root instead it
 * found nothing, so `ttsc src/x.ts --rootDir src` refused an included file and
 * ttsx reported its entry missing. Each lane now reads the effective root.
 *
 * 1. Create a project with `rootDir: "src"`, and one entry that imports a sibling
 *    module.
 * 2. Run it through ttsx with `--rootDir .`, and emit it with `ttsc src/main.ts
 *    --rootDir .` and with `--rootDir src`.
 * 3. Assert ttsx runs the entry and each emit writes the entry's own code.
 * @evidence contracts/testing.md#behavioral-verification Runs ttsx with --rootDir . and ttsc with rootDir . and src against main importing value; observes main:value and a main marker in each emitted file.
 * @evidence contracts/testing.md#independent-expectations The fixture authors main:value; emitted-file expectations require only the independently written main marker, not byte identity or execution of those two files.
 * @evidence contracts/testing.md#distinguishing-cases Two forwarded rootDir spellings exercise ttsc output lookup beside the ttsx run; emitted JavaScript equivalence is not asserted.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_and_ttsc_follow_a_forwarded_root_dir at this path, selected by tests/test-scripts-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Three real CLI invocations connect forwarded arguments, native compiler output naming and runtime loading; argument parser units alone do not establish that connection.
 * @evidence contracts/e2e.md#shared-execution One project and installed compiler serve all three invocations; lib is removed between the two ttsc emissions, while each invocation remains a fresh host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture has independent temporary ownership; synchronous hosts finish before lib removal, and TestProject retains the project until process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All three existing host results and emitted-file marker assertions remain here; no source-unit ownership is inferred from a similar parser case.
 */
export function test_ttsx_and_ttsc_follow_a_forwarded_root_dir() {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "forwarded-root", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "lib",
        rootDir: "src",
        types: [],
      },
      include: ["src"],
    }),
    "src/main.ts": [
      `import { value } from "./value";`,
      `console.log("main:" + value);`,
      ``,
    ].join("\n"),
    "src/value.ts": `export const value: string = "value";\n`,
  });

  const run = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "--rootDir", ".", "src/main.ts"],
    { cwd: root },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "main:value");

  for (const forwarded of [".", "src"]) {
    fs.rmSync(path.join(root, "lib"), { recursive: true, force: true });
    const emitted = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "src/main.ts", "--rootDir", forwarded],
      { cwd: root },
    );
    assert.equal(
      emitted.status,
      0,
      `--rootDir ${forwarded}: ${emitted.stdout}${emitted.stderr}`,
    );
    const output = emitted.stdout.trim().split(/\r?\n/).pop()!;
    const text = fs.readFileSync(path.resolve(root, output), "utf8");
    assert.match(text, /main:/, `--rootDir ${forwarded}`);
  }
}

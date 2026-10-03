import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx classifies `module: "node20"` from the package type, in both
 * directions.
 *
 * `node20` belongs to the node family whose emit format follows the nearest
 * `package.json` `"type"`, but the classifier listed only `node16`, `node18`,
 * and `nodenext`, so `node20` fell through to the ES-module default. tsgo emits
 * CommonJS for it in a package with no `"type"`, and Node then threw
 * `ReferenceError: exports is not defined in ES module scope`. The module
 * package is the twin: the same option must produce an ES module there, so the
 * fix cannot be "call node20 CommonJS".
 *
 * 1. Create one node20 program with CommonJS and module package scopes.
 * 2. Run the CommonJS entry and dynamically import the module-scoped fixture.
 * 3. Assert both succeed, the CommonJS one seeing `__dirname` and the module one
 *    seeing `import.meta.url`.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual compiler and ttsx Node host execute both node20 package scopes, asserting the CommonJS __dirname marker and module import.meta URL marker with successful exit.
 * @evidence contracts/testing.md#independent-expectations Node supplies __dirname only to CommonJS and import.meta.url only to ECMAScript modules; node20 emit follows the nearest package type, independently of the launcher classifier.
 * @evidence contracts/testing.md#distinguishing-cases The same compiler option selects CommonJS in a silent root package and ESM in a nested module package; both original exact marker assertions remain. The source module-format unit separately owns the complete node-family/package decision matrix.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry invokes the public compiler-backed runtime once; authored fixtures are compiler inputs and one dynamic import connects both actual Node execution environments.
 * @evidence contracts/e2e.md#necessary-boundary The actual compiler's node20 emits and Node's CJS/ESM handlers must agree with module-format selection; direct classifier calls cannot prove the emitted-byte/host connection.
 * @evidence contracts/e2e.md#shared-execution Both package-type cases share one identical node20 compiler configuration, project load and public runtime session. The CJS entry imports the ESM-scoped fixture so a second project build or launcher lifetime is unnecessary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Separate nearest-package scopes preserve conflicting module-format inputs within one immutable fixture; both modules are emitted by one program and synchronous spawn completes before TestProject owns fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The former independent hosts' zero-exit and exact node20-commonjs/node20-module outputs are retained in order in one host. Neither nearest package type nor CJS/ESM runtime globals is simulated; the source unit supplements policy branches.
 */
export function test_ttsx_classifies_module_node20_from_the_package_type() {
  const compilerOptions = {
    target: "ES2022",
    module: "node20",
    moduleResolution: "node16",
    strict: true,
    outDir: "lib",
    rootDir: "src",
  };

  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "node20-cjs", version: "1.0.0" }),
    "tsconfig.json": JSON.stringify({ compilerOptions, include: ["src"] }),
    "src/globals.d.ts": "declare const __dirname: string;\n",
    "src/main.ts": "export {};\nconsole.log(typeof __dirname === \"string\" ? \"node20-commonjs\" : \"wrong\");\nvoid import(\"./esm/main.js\");\n",
    "src/esm/package.json": JSON.stringify({ name: "node20-esm", version: "1.0.0", type: "module" }),
    "src/esm/main.ts": "export {};\nconsole.log(import.meta.url.startsWith(\"file:\") ? \"node20-module\" : \"wrong\");\n",
  });
  const result = TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split(/\r?\n/), ["node20-commonjs", "node20-module"]);
}

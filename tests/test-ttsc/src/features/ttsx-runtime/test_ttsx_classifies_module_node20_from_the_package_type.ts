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
 * 1. Create one CommonJS and one `"type": "module"` project, both on `node20`.
 * 2. Run ttsx against each entry.
 * 3. Assert both succeed, the CommonJS one seeing `__dirname` and the module one
 *    seeing `import.meta.url`.
 */
export const test_ttsx_classifies_module_node20_from_the_package_type = () => {
  const compilerOptions = {
    target: "ES2022",
    module: "node20",
    moduleResolution: "node16",
    strict: true,
    outDir: "lib",
    rootDir: "src",
  };

  const commonJsRoot = TestProject.createProject({
    "package.json": JSON.stringify({ name: "node20-cjs", version: "1.0.0" }),
    "tsconfig.json": JSON.stringify({ compilerOptions, include: ["src"] }),
    "src/globals.d.ts": `declare const __dirname: string;\n`,
    "src/main.ts": `export {};\nconsole.log(typeof __dirname === "string" ? "node20-commonjs" : "wrong");\n`,
  });
  const commonJs = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", commonJsRoot, "src/main.ts"],
    { cwd: commonJsRoot },
  );
  assert.equal(commonJs.status, 0, commonJs.stderr);
  assert.equal(commonJs.stdout.trim(), "node20-commonjs");

  const moduleRoot = TestProject.createProject({
    "package.json": JSON.stringify({
      name: "node20-esm",
      version: "1.0.0",
      type: "module",
    }),
    "tsconfig.json": JSON.stringify({ compilerOptions, include: ["src"] }),
    "src/main.ts": `export {};\nconsole.log(import.meta.url.startsWith("file:") ? "node20-module" : "wrong");\n`,
  });
  const esModule = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", moduleRoot, "src/main.ts"],
    { cwd: moduleRoot },
  );
  assert.equal(esModule.status, 0, esModule.stderr);
  assert.equal(esModule.stdout.trim(), "node20-module");
};

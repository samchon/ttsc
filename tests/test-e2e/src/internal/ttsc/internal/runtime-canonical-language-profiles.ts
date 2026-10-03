import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import fixture from "./runtime-decorator-fixture.json" with { type: "json" };
import type { runCanonicalRuntimeProfiles } from "./runtime-canonical-profile-assembly";
import { STANDARD_DECORATOR_OUTPUT, STANDARD_DECORATOR_SOURCE } from "./ttsx-decorators";
import { JSX_COMPONENT_OUTPUT, JSX_COMPONENT_SOURCE, JSX_RUNTIME_PACKAGE } from "./ttsx-jsx";
import { TTSX_REGISTER, linkTtscPackage } from "./ttsx-register";

/**
 * Stages original decorator publication, rejection, options, package exports,
 * ESM member and public JSX inputs on
 * the already joined canonical root. Every profile retains its actual public
 * compiler/register/launcher transport and independent literal observations.
 *
 * @evidence contracts/common.md#principled-implementation Original byte snapshots and actual ordinary emit, runtime and public preload calls determine outcomes; compiler emission or effects are not simulated.
 * @evidence contracts/common.md#clear-and-simple-design Publication, rejection, option, package-export and JSX/member profiles share the existing staging owner and fixture constants, keeping incompatible configs separate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Published output is read from the actual ordinary compiler and compared after runtime execution. A missing artifact blocks only its dependent profile rather than supplying guessed bytes.
 * @evidence contracts/common.md#meaningful-documentation States original transport, staged preparation and independent output/nonmutation oracles without claiming execution.
 * @evidence contracts/portability.md#os-neutral-implementation Native path joins address exact extension-selected emits; public Node/TTSC/TTSX argv and actual package link preserve their existing owning operations.
 * @evidence contracts/performance.md#efficient-algorithms Source maps scale with original fixture bytes; publication profiles read their actual outputs before and after. Each native command retains independent cost.
 * @evidence contracts/performance.md#reuse-equivalent-work Eighteen original allocations borrow the canonical root and shipped tools. Different module, extension, library, invalid program, JSX mode and public entry transports remain separate requests and Program work.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Existing assembler owns launch receipts and holds exact completed graphs before another stage; callback file reads close synchronously and unknown launches retain inputs.
 * @evidence contracts/testing.md#behavioral-verification Four ordinary emits preserve decorator syntax while runtime effects and source/config/output bytes remain exact; ESM member effects and public JSX registration/CLI outputs retain their complete original literals.
 * @evidence contracts/testing.md#independent-expectations Authored decorator/member fixture strings and JSX HTML determine output; captured ordinary compiler bytes establish nonmutation independently of runtime emission.
 * @evidence contracts/testing.md#distinguishing-cases ESNext/CommonJS TS and NodeNext MTS/CTS, ESM member initialization, public JSX registration/CLI, invalid decorator/missing library/invalid target rejection, config versus forwarded target, explicit library DOM absence and computed package exports are separate profiles.
 * @evidence contracts/testing.md#execution-ownership Consolidated Runtime explicitly selects these callbacks; original standalone donors remain unchanged. Profiles call maintained public tools instead of a test-output generator.
 * @evidence contracts/e2e.md#necessary-boundary Ordinary publication versus transient runtime, ESM bootstrap, and public register/CLI JSX transport require real compiler and Node connections beyond emission-policy units.
 * @evidence contracts/e2e.md#shared-execution Eighteen original roots become staged configurations on the one canonical allocation; twenty-five native public requests remain separate authored calls whose actual process and Program costs await remote measurement.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The existing assembler holds previous input/output/cache aliases, preserving each immutable profile and blocking transitions after unknown launches. Ordinary build and runtime share one profile so captured publication is never replaced between assertions.
 * @evidence contracts/e2e.md#preserved-coverage Retains test_ttsx_executes_standard_decorators_at_esnext four emit/runtime pairs and all byte assertions; test_ttsx_standard_decorators_preserve_member_initialization ESM value/order; test_ttsx_runs_preserved_jsx_through_the_automatic_runtime HTML/config bytes; test_ttsx_compiles_a_forwarded_jsx_preserve_for_the_runtime both exact HTML outputs; test_ttsx_standard_decorators_reject_invalid_programs_before_effects five status/diagnostic/no-effect triples; test_ttsx_standard_decorators_preserve_cli_and_library_options three complete effects; and test_ttsx_decorator_export_discovery_never_removes_runtime_values complete effects plus 17/42 exports; and test_ttsx_register_executes_excluded_standard_decorators all four direct/public-register format outputs and statuses. Actual surviving execution and donor removal remain pending.
 */
export function canonicalRuntimeLanguageProfiles(): Parameters<typeof runCanonicalRuntimeProfiles>[1] {
  const profiles: Parameters<typeof runCanonicalRuntimeProfiles>[1][number][] = [];
  for (const [module, extension] of [["esnext", "ts"], ["commonjs", "ts"], ["nodenext", "mts"], ["nodenext", "cts"]]) {
    const entry = `src/main.${extension}`;
    profiles.push({
      name: `decorator-publication-${module}-${extension}`,
      files: {
        "package.json": JSON.stringify({ type: module === "commonjs" ? "commonjs" : "module" }),
        "tsconfig.json": TestProject.tsconfig({ target: "ESNext", module, strict: true, rootDir: "src", outDir: "dist", declaration: true }),
        [entry]: STANDARD_DECORATOR_SOURCE,
      },
      run: (root, _persistent, spawn) => {
        const failures: unknown[] = [];
        const config = fs.readFileSync(path.join(root, "tsconfig.json"), "utf8");
        const built = spawn(TestProject.TTSC_BIN, ["--emit"], { cwd: root });
        try { assert.equal(built.status, 0, built.stderr); } catch (error) { failures.push(error); }
        const output = path.join(root, "dist", `main.${extension === "mts" ? "mjs" : extension === "cts" ? "cjs" : "js"}`);
        const emitted = fs.readFileSync(output, "utf8");
        try { assert.match(emitted, /@sayHelloClass/); } catch (error) { failures.push(error); }
        const result = spawn(TestProject.TTSX_BIN, [entry], { cwd: root });
        try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
        try { assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT); } catch (error) { failures.push(error); }
        try { assert.equal(fs.readFileSync(output, "utf8"), emitted); } catch (error) { failures.push(error); }
        try { assert.equal(fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"), config); } catch (error) { failures.push(error); }
        try { assert.equal(fs.readFileSync(path.join(root, entry), "utf8"), STANDARD_DECORATOR_SOURCE); } catch (error) { failures.push(error); }
        if (failures.length) throw new AggregateError(failures, "executes_standard_decorators_at_esnext assertions failed");
      },
    });
  }
  profiles.push({
    name: "decorator-esm-member-initialization",
    files: {
      "package.json": JSON.stringify({ type: "module" }),
      "tsconfig.json": TestProject.tsconfig({ target: "ESNext", module: "esnext", strict: true, rootDir: "src", outDir: "dist" }),
      "src/main.ts": fixture.memberSource,
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), fixture.memberExpected);
    },
  });
  const preserveConfig = JSON.stringify({ compilerOptions: { target: "ES2022", module: "commonjs", strict: true, jsx: "preserve", jsxImportSource: "myjsx", outDir: "lib", types: [] }, include: ["src"] });
  profiles.push({
    name: "jsx-public-preserve-register",
    files: {
      ...JSX_RUNTIME_PACKAGE,
      "package.json": JSON.stringify({ name: "preserved-jsx", private: true }),
      "tsconfig.json": preserveConfig,
      "src/view.tsx": JSX_COMPONENT_SOURCE,
      "src/main.tsx": ['import { view } from "./view";', "console.log(view);", ""].join("\n"),
    },
    run: (root, _persistent, spawn) => {
      linkTtscPackage(root);
      const result = spawn(process.execPath, ["--require", TTSX_REGISTER, "src/main.tsx"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), JSX_COMPONENT_OUTPUT);
      assert.equal(fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"), preserveConfig);
    },
  });
  profiles.push({
    name: "jsx-automatic-and-forwarded-preserve",
    files: {
      ...JSX_RUNTIME_PACKAGE,
      "package.json": JSON.stringify({ name: "forwarded-jsx", private: true }),
      "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "commonjs", strict: true, jsx: "react-jsx", jsxImportSource: "myjsx", outDir: "lib", types: [] }, include: ["src"] }),
      "src/main.tsx": [JSX_COMPONENT_SOURCE, "console.log(view);", ""].join("\n"),
    },
    run: (root, _persistent, spawn) => {
      for (const flags of [[], ["--jsx", "preserve"]]) {
        const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, ...flags, "src/main.tsx"], { cwd: root });
        assert.equal(result.status, 0, `${flags.join(" ")}: ${result.stderr}`);
        assert.equal(result.stdout.trim(), JSX_COMPONENT_OUTPUT);
      }
    },
  });
  for (const [index, row] of [
    { options: {}, args: [], source: 'function invalid() { return 42; }\n@invalid\nclass Foo {}\nconsole.log("executed");', diagnostic: /TS1329/ },
    { options: { lib: [] }, args: [], source: STANDARD_DECORATOR_SOURCE, diagnostic: /TS2318/ },
    { options: { noLib: true }, args: [], source: STANDARD_DECORATOR_SOURCE, diagnostic: /TS2318/ },
    { options: {}, args: ["--noLib"], source: STANDARD_DECORATOR_SOURCE, diagnostic: /TS2318/ },
    { options: {}, args: ["--target", "invalid"], source: STANDARD_DECORATOR_SOURCE, diagnostic: /TS6046/ },
  ].entries()) {
    profiles.push({
      name: `decorator-rejection-before-effects-${index}`,
      files: {
        "tsconfig.json": TestProject.tsconfig({ target: "ESNext", module: "commonjs", strict: true, outDir: "dist", rootDir: "src", ...row.options }),
        "src/main.ts": row.source,
      },
      run: (root, _persistent, spawn) => {
        const result = spawn(TestProject.TTSX_BIN, [...row.args, "src/main.ts"], { cwd: root });
        const failures: unknown[] = [];
        try { assert.notEqual(result.status, 0); } catch (error) { failures.push(error); }
        try { assert.match(result.stderr + result.stdout, row.diagnostic); } catch (error) { failures.push(error); }
        try { assert.doesNotMatch(result.stdout, /Hello Class|Hello Function|executed/); } catch (error) { failures.push(error); }
        if (failures.length) throw new AggregateError(failures, "standard_decorators_reject_invalid_programs_before_effects assertions failed");
      },
    });
  }
  for (const args of [[], ["--target", "es2019", "-target", "esnext"]]) {
    profiles.push({
      name: args.length ? "decorator-forwarded-cli-target" : "decorator-config-target",
      files: {
        "package.json": JSON.stringify({ type: "module" }),
        "tsconfig.json": TestProject.tsconfig({ target: args.length ? "ES2019" : "ESNext", strict: true, rootDir: "src", outDir: "dist", resolveJsonModule: true }),
        "src/data.json": '{"value":42}',
        "src/main.ts": 'import data from "./data.json" with { type: "json" };\nlet disposal: Disposable | undefined; void disposal;\n' + STANDARD_DECORATOR_SOURCE + "\nconsole.log(data.value);",
      },
      run: (root, _persistent, spawn) => {
        const result = spawn(TestProject.TTSX_BIN, [...args, "src/main.ts"], { cwd: root });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT + "\n42");
      },
    });
  }
  profiles.push({
    name: "decorator-explicit-library-preserves-dom-absence",
    files: {
      "package.json": '{"type":"module"}',
      "tsconfig.json": TestProject.tsconfig({ target: "ESNext", module: "esnext", strict: true, rootDir: "src", outDir: "dist", lib: ["esnext"] }),
      "src/main.ts": 'declare const console: { log(...args: unknown[]): void };\nif (false) {\n// @ts-expect-error DOM must remain absent.\ndocument.title = "forbidden";\n}\n' + STANDARD_DECORATOR_SOURCE,
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT);
    },
  });
  profiles.push({
    name: "decorator-dynamic-package-export-discovery",
    files: {
      "package.json": '{"type":"module"}',
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "esnext", rootDir: "src", outDir: "dist" }),
      "src/main.ts": 'const name: string = "dep"; const dep = await import(name); console.log(dep.actual, dep.default.dynamic); export {};',
      "node_modules/dep/package.json": '{"name":"dep","type":"commonjs","exports":"./index.ts"}',
      "node_modules/dep/index.ts": STANDARD_DECORATOR_SOURCE + '\nexport * from "./values/entry";',
      "node_modules/dep/values/tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", rootDir: ".", outDir: "lib" }, { include: ["entry.ts"] }),
      "node_modules/dep/values/entry.ts": 'export const actual = 17; export * from "./dynamic.cjs";',
      "node_modules/dep/values/dynamic.cjs": 'module.exports["dyn" + "amic"] = 42;',
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT + "\n17 42");
    },
  });
  for (const module of ["esnext", "commonjs"]) {
    profiles.push({
      name: `decorator-excluded-public-register-${module}`,
      files: {
        "package.json": JSON.stringify({ type: module === "commonjs" ? "commonjs" : "module" }),
        "base.json": JSON.stringify({ compilerOptions: { target: "ESNext", module, strict: true } }),
        "tsconfig.json": JSON.stringify({ extends: "./base.json", compilerOptions: { rootDir: "src", outDir: "dist" }, include: ["src"] }),
        "src/included.ts": "export const included = true;",
        "scripts/main.ts": STANDARD_DECORATOR_SOURCE,
      },
      run: (root, _persistent, spawn) => {
        linkTtscPackage(root);
        const failures: unknown[] = [];
        for (const [command, args] of [
          [TestProject.TTSX_BIN, ["scripts/main.ts"]],
          [process.execPath, ["--require", TTSX_REGISTER, "scripts/main.ts"]],
        ] as const) {
          const result = spawn(command, [...args], { cwd: root });
          try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
          try { assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT); } catch (error) { failures.push(error); }
        }
        if (failures.length) throw new AggregateError(failures, "register_executes_excluded_standard_decorators assertions failed");
      },
    });
  }
  return profiles;
}

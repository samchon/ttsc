import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../FixtureFiles";
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
 * @evidence contracts/performance.md#reuse-equivalent-work Thirty-five original allocations borrow the canonical root and shipped tools. Different module, extension, library, invalid program, JSX mode and public entry transports remain separate requests and Program work.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Existing assembler owns launch receipts and holds exact completed graphs before another stage; callback file reads close synchronously and unknown launches retain inputs.
 * @evidence contracts/testing.md#behavioral-verification Four ordinary emits preserve decorator syntax while runtime effects and source/config/output bytes remain exact; ESM member effects and public JSX registration/CLI outputs retain their complete original literals.
 * @evidence contracts/testing.md#independent-expectations Authored decorator/member fixture strings and JSX HTML determine output; captured ordinary compiler bytes establish nonmutation independently of runtime emission.
 * @evidence contracts/testing.md#distinguishing-cases ESNext/CommonJS TS and NodeNext MTS/CTS, ESM member initialization, public JSX registration/CLI, invalid decorator/missing library/invalid target rejection, config versus forwarded target, explicit library DOM absence and computed package exports are separate profiles.
 * @evidence contracts/testing.md#execution-ownership Consolidated Runtime explicitly selects these callbacks; original standalone donors remain unchanged. Profiles call maintained public tools instead of a test-output generator.
 * @evidence contracts/e2e.md#necessary-boundary Ordinary publication versus transient runtime, ESM bootstrap, and public register/CLI JSX transport require real compiler and Node connections beyond emission-policy units.
 * @evidence contracts/e2e.md#shared-execution Thirty-five original roots become staged configurations on the one canonical allocation; fifty-three native public requests remain separate authored calls whose actual process and Program costs await remote measurement.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The existing assembler holds previous input/output/cache aliases, preserving each immutable profile and blocking transitions after unknown launches. Ordinary build and runtime share one profile so captured publication is never replaced between assertions.
 * @evidence contracts/e2e.md#preserved-coverage Retains test_ttsx_executes_standard_decorators_at_esnext four emit/runtime pairs and all byte assertions; test_ttsx_standard_decorators_preserve_member_initialization ESM value/order; test_ttsx_runs_preserved_jsx_through_the_automatic_runtime HTML/config bytes; test_ttsx_compiles_a_forwarded_jsx_preserve_for_the_runtime both exact HTML outputs; test_ttsx_standard_decorators_reject_invalid_programs_before_effects five status/diagnostic/no-effect triples; test_ttsx_standard_decorators_preserve_cli_and_library_options three complete effects; and test_ttsx_decorator_export_discovery_never_removes_runtime_values complete effects plus 17/42 exports; and test_ttsx_register_executes_excluded_standard_decorators all four direct/public-register format outputs and statuses; test_ttsx_register_stops_diagnostics_before_entry_effects both diagnostic/status/marker matrices, initial empty cache and prior FIRST ordering; and test_ttsx_rejects_a_require_without_a_value original launcher rejection; test_ttsx_classifies_module_preserve_as_ecmascript_modules original ESM output; and test_ttsx_classifies_the_entry_by_a_forwarded_module_flag all six owned/excluded direct/response status and output pairs; test_ttsx_classifies_a_node_modules_package_type_over_the_project_module_option exact dependency/project values; test_runner_corpus_invalid_tsconfig_prevents_entry_execution diagnostic/location/no stdout effect/no marker; and test_ttsx_compiles_a_required_source_whose_project_lists_no_files fallback arguments=3; test_ttsx_emits_an_installed_package_root_whose_config_sets_no_emit_on_error installed-root arguments=3; and test_ttsx_builds_a_dependency_whose_config_sets_no_emit_on_error wrapped-7 project-built=true live manifest/cache witness; test_ttsx_follows_directory_references_nested_solutions_and_cycles exact entry=3 dependency=3; test_ttsx_selects_the_project_through_the_legacy_uppercase_p_flag ENTRY/explicit-runner-project pair; and test_ttsx_resolves_config_dir_paths_for_an_installed_package_root area-9; test_ttsx_runs_the_entry_as_the_main_module all six native main/argv/handled/exit/throw/rejection observations; and test_ttsx_runs_preserved_jsx_in_a_dependency_and_an_orphan both HTML outputs and independent failure inputs; test_ttsx_checks_a_typescript_file_the_program_generates_before_running_it exact typed-to-mistyped writes/status/value/root diagnostic/no-output transition; and test_ttsx_runs_a_source_file_the_entry_generates_at_runtime extensionless VALUE:42. Actual surviving execution and donor removal remain pending.
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
  profiles.push({
    name: "public-register-project-diagnostics-before-effects",
    files: {
      ...FixtureFiles.read("ttsc/ttsx_register_stops_diagnostics_before_entry_effects/inputs-1"),
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", strict: true, outDir: "dist", rootDir: "src" }),
    },
    run: (root, _persistent, spawn) => {
      linkTtscPackage(root);
      const marker = path.join(root, "executed.txt");
      const result = spawn(process.execPath, ["--require", TTSX_REGISTER, "src/main.ts"], { cwd: root, env: { TTSX_REGISTER_MARKER: marker } });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /project check failed/);
      assert.match(result.stderr, /Type 'number' is not assignable to type 'string'/);
      assert.equal(fs.existsSync(marker), false);
      const runtimeRoot = path.join(root, "node_modules", ".cache", "ttsc", "ttsx", "project");
      assert.deepEqual(fs.existsSync(runtimeRoot) ? fs.readdirSync(runtimeRoot) : [], []);
    },
  });
  profiles.push({
    name: "public-register-prior-effects-then-entry-diagnostics",
    files: {
      "host.cjs": ['require("./test/first/index.ts");', 'require("./test/second/index.ts");', ""].join("\n"),
      "package.json": JSON.stringify({ type: "commonjs" }),
      "src/value.ts": 'export const value = "included";\n',
      "test/first/index.ts": 'console.log("FIRST");\n',
      "test/second/index.ts": ['import fs from "node:fs";', 'const invalid: string = 123;', 'fs.writeFileSync(process.env.TTSX_REGISTER_MARKER!, invalid);', ""].join("\n"),
      "tsconfig.json": JSON.stringify({ compilerOptions: { module: "commonjs", outDir: "dist", rootDir: "src", strict: true, target: "ES2022" }, include: ["src"] }),
    },
    run: (root, _persistent, spawn) => {
      linkTtscPackage(root);
      const marker = path.join(root, "executed.txt");
      const result = spawn(process.execPath, ["--require", TTSX_REGISTER, "host.cjs"], { cwd: root, env: { TTSX_REGISTER_MARKER: marker } });
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout.trim(), "FIRST");
      assert.match(result.stderr, /entry check failed/);
      assert.match(result.stderr, /Type 'number' is not assignable to type 'string'/);
      assert.equal(fs.existsSync(marker), false);
    },
  });
  profiles.push({
    name: "public-launcher-missing-require-value",
    files: FixtureFiles.read("ttsc/ttsx_rejects_a_require_without_a_value/inputs-1"),
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "-r"], { cwd: root });
      assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
      assert.match(result.stderr, /-r requires a value/);
    },
  });
  profiles.push({
    name: "public-runtime-module-preserve",
    files: FixtureFiles.read("ttsc/ttsx_classifies_module_preserve_as_ecmascript_modules/inputs-1"),
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "preserve-stays-esm");
    },
  });
  profiles.push({
    name: "public-runtime-forwarded-module-and-response",
    files: {
      ...FixtureFiles.read("ttsc/ttsx_classifies_the_entry_by_a_forwarded_module_flag/inputs-1"),
      "module.rsp": "--module\nesnext\n",
    },
    run: (root, _persistent, spawn) => {
      const responseFile = path.join(root, "module.rsp");
      const failures: Error[] = [];
      for (const flags of [["--module", "esnext"], ["--module", "preserve"], [`@${responseFile}`]]) {
        for (const [entry, expected] of [["src/main.ts", "inside helped"], ["outside.ts", "outside helped"]] as const) {
          const label = `${flags.join(" ")} ${entry}`;
          const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, ...flags, entry], { cwd: root });
          try {
            assert.equal(result.status, 0, `${label}: ${result.stderr}`);
            assert.equal(result.stdout.trim(), expected, label);
          } catch (error) { failures.push(new Error(label, { cause: error })); }
        }
      }
      if (failures.length) throw new AggregateError(failures, "forwarded module profiles failed");
    },
  });
  profiles.push({
    name: "public-runtime-package-store-format-precedence",
    files: FixtureFiles.read("ttsc/ttsx_classifies_a_node_modules_package_type_over_the_project_module_option/inputs-1"),
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "cjs-dependency|esm-by-project");
    },
  });
  profiles.push({
    name: "public-runtime-invalid-config-before-effects",
    files: FixtureFiles.read("ttsc/runner_corpus_invalid_tsconfig_prevents_entry_execution/inputs-1"),
    run: (root, _persistent, spawn) => {
      const marker = path.join(root, "invalid-config-marker.txt");
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root, env: { TTSX_MARKER: marker } });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /'\}' expected \(line 1 column \d+\)/);
      assert.doesNotMatch(result.stdout, /invalid-config-should-not-run/);
      assert.equal(fs.existsSync(marker), false);
    },
  });
  profiles.push({
    name: "public-runtime-empty-owning-project-fallback",
    files: FixtureFiles.read("ttsc/ttsx_compiles_a_required_source_whose_project_lists_no_files/inputs-1"),
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "arguments=3");
    },
  });
  for (const [name, fixtureIdentity, expected] of [
    ["public-runtime-installed-root-no-emit-on-error", "ttsc/ttsx_emits_an_installed_package_root_whose_config_sets_no_emit_on_error/inputs-1", "arguments=3"],
    ["public-runtime-dependency-no-emit-on-error", "ttsc/ttsx_builds_a_dependency_whose_config_sets_no_emit_on_error/inputs-1", "wrapped-7 project-built=true"],
  ] as const) {
    profiles.push({
      name,
      files: FixtureFiles.read(fixtureIdentity),
      run: (root, _persistent, spawn) => {
        const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout.trim(), expected);
      },
    });
  }
  const referenceProbe = (name: string): string => [
    "let observed: number = 0;",
    "function probe(...args: any[]): void {",
    "  observed = args.length;",
    "}",
    "class Box {",
    "  @probe",
    "  method(): void {}",
    "}",
    "new Box();",
    `export const ${name}: number = observed;`,
    "",
  ].join("\n");
  const referenceLib = JSON.stringify({ compilerOptions: { target: "ES2022", module: "commonjs", strict: true, experimentalDecorators: true, types: [] }, include: ["src"] });
  profiles.push({
    name: "public-runtime-nested-reference-solutions-and-cycle",
    files: {
      "package.json": JSON.stringify({ name: "nested", private: true }),
      "tsconfig.json": JSON.stringify({ files: [], references: [{ path: "./packages/app" }, { path: "./packages/dep" }] }),
      "packages/app/tsconfig.json": JSON.stringify({ files: [], references: [{ path: "../.." }, { path: "./tsconfig.lib.json" }] }),
      "packages/app/tsconfig.lib.json": referenceLib,
      "packages/app/src/main.ts": [referenceProbe("entry"), 'declare const require: (path: string) => { dependency: number };', 'const { dependency } = require("../../dep/src/value.ts");', 'console.log("entry=" + entry + " dependency=" + dependency);', ""].join("\n"),
      "packages/dep/tsconfig.json": JSON.stringify({ files: [], references: [{ path: "./tsconfig.lib.json" }] }),
      "packages/dep/tsconfig.lib.json": referenceLib,
      "packages/dep/src/value.ts": referenceProbe("dependency"),
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "packages/app/src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "entry=3 dependency=3");
    },
  });
  profiles.push({
    name: "public-runtime-legacy-uppercase-project-selection",
    files: FixtureFiles.read("ttsc/ttsx_selects_the_project_through_the_legacy_uppercase_p_flag/inputs-1"),
    run: (root, _persistent, spawn) => {
      const args = ["-P", "alt/tsconfig.json"];
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, ...args, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, `ttsx ${args.join(" ")}:\n${result.stdout}${result.stderr}`);
      assert.match(result.stdout, /ENTRY/);
      assert.deepEqual(result.stdout.trim().split(/\r?\n/), ["ENTRY", "explicit-runner-project"]);
    },
  });
  profiles.push({
    name: "public-runtime-installed-config-dir-resolution",
    files: FixtureFiles.read("ttsc/ttsx_resolves_config_dir_paths_for_an_installed_package_root/inputs-1"),
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "area-9");
    },
  });
  profiles.push({
    name: "public-runtime-native-main-and-terminal-behavior",
    files: FixtureFiles.read("ttsc/ttsx_runs_the_entry_as_the_main_module/inputs-1"),
    run: (root, _persistent, spawn) => {
      const run = (entry: string) => spawn(TestProject.TTSX_BIN, ["--cwd", root, entry], { cwd: root });
      const failures: unknown[] = [];
      try {
        const cjs = run("src/cjs.ts");
        assert.equal(cjs.status, 0, cjs.stderr);
        const reported = JSON.parse(cjs.stdout.trim()) as { main: boolean; argv1: string };
        assert.equal(reported.main, true);
        assert.equal(fs.realpathSync.native(reported.argv1), fs.realpathSync.native(path.join(root, "src", "cjs.ts")));
      } catch (error) { failures.push(error); }
      try {
        const esm = run("src/esm.mts");
        assert.equal(esm.status, 0, esm.stderr);
        const meta = JSON.parse(esm.stdout.trim()) as { main?: unknown; helperMain?: unknown };
        if ("main" in import.meta) {
          assert.equal(meta.main, true);
          assert.equal(meta.helperMain, false);
        } else {
          assert.equal(meta.main, undefined);
          assert.equal(meta.helperMain, undefined);
        }
      } catch (error) { failures.push(error); }
      try {
        const handled = run("src/handled.ts");
        assert.equal(handled.status, 0, handled.stderr);
        assert.deepEqual(handled.stdout.trim().split(/\r?\n/), ["handled: boom", "still alive"]);
      } catch (error) { failures.push(error); }
      try { assert.equal(run("src/exit.ts").status, 7); } catch (error) { failures.push(error); }
      try {
        const thrown = run("src/throws.ts");
        assert.equal(thrown.status, 1, thrown.stdout);
        assert.match(thrown.stderr, /unhandled/);
      } catch (error) { failures.push(error); }
      try {
        const rejected = run("src/rejects.mts");
        assert.equal(rejected.status, 1, rejected.stdout);
        assert.match(rejected.stderr, /rejected/);
      } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, "native main-module entry failures");
    },
  });
  profiles.push({
    name: "public-runtime-preserved-jsx-dependency-and-orphan",
    files: {
      ...JSX_RUNTIME_PACKAGE,
      "package.json": JSON.stringify({ name: "jsx-lanes", private: true }),
      "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "commonjs", strict: true, outDir: "lib", types: [] }, include: ["src"] }),
      "src/main.ts": ['declare const require: (id: string) => { view: string };', 'declare const process: { exitCode: number };', 'try { console.log(require("../dep/view.tsx").view); } catch (error) { console.log("DEPENDENCY_FAILED:" + String(error)); process.exitCode = 1; }', 'try { console.log(require("orphan-view").view); } catch (error) { console.log("ORPHAN_FAILED:" + String(error)); process.exitCode = 1; }', 'export {};', ""].join("\n"),
      "dep/tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "commonjs", strict: true, jsx: "preserve", jsxImportSource: "myjsx", types: [] }, include: ["view.tsx"] }),
      "dep/view.tsx": JSX_COMPONENT_SOURCE,
      "node_modules/orphan-view/package.json": JSON.stringify({ name: "orphan-view", version: "1.0.0", main: "view.tsx" }),
      "node_modules/orphan-view/view.tsx": ['/** @jsxImportSource myjsx */', 'export const view: string = <i>orphan</i>;', ""].join("\n"),
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(result.stdout.trim().split(/\r?\n/), ["<div>hello</div><b>world</b>", "<i>orphan</i>"]);
    },
  });
  profiles.push({
    name: "public-runtime-generated-source-typed-then-mistyped",
    files: FixtureFiles.read("ttsc/ttsx_checks_a_typescript_file_the_program_generates_before_running_it/inputs-1"),
    run: (root, _persistent, spawn) => {
      const typed = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root, env: { GENERATED_SOURCE: 'export const value: string = "generated";\n' } });
      assert.equal(typed.status, 0, typed.stderr);
      assert.equal(typed.stdout.trim(), "value=generated");
      const mistyped = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root, env: { GENERATED_SOURCE: 'export const value: number = "mistyped";\n' } });
      assert.notEqual(mistyped.status, 0, mistyped.stdout);
      assert.match(mistyped.stderr, /root check failed for .*value\.ts/);
      assert.match(mistyped.stderr, /Type 'string' is not assignable to type 'number'/);
      assert.doesNotMatch(mistyped.stdout, /value=/);
    },
  });
  profiles.push({
    name: "public-runtime-runtime-generated-extensionless-source",
    files: FixtureFiles.read("ttsc/ttsx_runs_a_source_file_the_entry_generates_at_runtime/inputs-1"),
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "VALUE:42");
    },
  });
  return profiles;
}

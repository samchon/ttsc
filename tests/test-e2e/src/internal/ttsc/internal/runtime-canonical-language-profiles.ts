import { TestProject } from "@ttsc/testing";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { TtscCompiler } from "../../../../../../packages/ttsc/lib/index.js";

import { FixtureFiles } from "../../FixtureFiles";
import fixture from "./runtime-decorator-fixture.json" with { type: "json" };
import type { runCanonicalRuntimeProfiles } from "./runtime-canonical-profile-assembly";
import { STANDARD_DECORATOR_OUTPUT, STANDARD_DECORATOR_SOURCE } from "./ttsx-decorators";
import { JSX_COMPONENT_OUTPUT, JSX_COMPONENT_SOURCE, JSX_RUNTIME_PACKAGE } from "./ttsx-jsx";
import { MOCHA_BIN, TTSX_REGISTER, linkTtscPackage } from "./ttsx-register";
import { isolatedCacheEnvironment } from "./isolated-cache-environment";
import { spawnNodeWorker } from "./source-build";
import { WAITING_PROGRAM, forceTerminate, isRunning, runDirectory, runtimeRunsDirectory, startWaitingRun, stopWaitingRun, type IWaitingRun } from "./ttsx-run";
import { THROWER_THROW_COLUMN, THROWER_THROW_LINE, maxFunctionCount, physicalRealpath, runTtsxWithCoverage, sourceMapSourcePath, tallCommentLibrarySource, tallCommentThrowerSource } from "./ttsx-source-map";

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
 * @evidence contracts/performance.md#reuse-equivalent-work Up to ninety-four original allocations borrow the canonical root and shipped tools. Different module, extension, library, invalid program, JSX mode and public entry transports remain separate requests and Program work.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Existing assembler owns launch receipts and holds exact completed graphs before another stage; callback file reads close synchronously and unknown launches retain inputs.
 * @evidence contracts/testing.md#behavioral-verification Four ordinary emits preserve decorator syntax while runtime effects and source/config/output bytes remain exact; ESM member effects and public JSX registration/CLI outputs retain their complete original literals.
 * @evidence contracts/testing.md#independent-expectations Authored decorator/member fixture strings and JSX HTML determine output; captured ordinary compiler bytes establish nonmutation independently of runtime emission.
 * @evidence contracts/testing.md#distinguishing-cases ESNext/CommonJS TS and NodeNext MTS/CTS, ESM member initialization, public JSX registration/CLI, invalid decorator/missing library/invalid target rejection, config versus forwarded target, explicit library DOM absence and computed package exports are separate profiles.
 * @evidence contracts/testing.md#execution-ownership Consolidated Runtime explicitly selects these callbacks; original standalone donors remain unchanged. Profiles call maintained public tools instead of a test-output generator.
 * @evidence contracts/e2e.md#necessary-boundary Ordinary publication versus transient runtime, ESM bootstrap, and public register/CLI JSX transport require real compiler and Node connections beyond emission-policy units.
 * @evidence contracts/e2e.md#shared-execution Up to ninety-four original roots become staged configurations on the one canonical allocation; up to one hundred forty-eight authored public/worker requests plus two bounded departed-owner setup sequences remain separate authored calls whose actual process and Program costs await remote measurement. Live physical dependency roots retain both native spelling comparisons with the original capability-false outcome; the empty nearer install retains two cache queries around its one host and child-local empty override. Linked run-index descriptor retarget keeps fresh original/victim indices beneath the existing external input island and its one negative host; unresolved launch or failed alias removal retains those inputs and aborts reuse. Flat and nested check-only inputs retain separate inferred-root requests and both source-adjacent emit absence checks; they reuse the canonical allocation only after the prior graph is held. The POSIX failure memo profile records all actual native argv while its single failed project emit count excludes enabled terminal config/source-list inspections; their process costs remain measured. The compiled owner preload uses three original Node lifetimes for existing-run admission, missing-run rejection and empty-manifest independence.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The existing assembler holds previous input/output/cache aliases, preserving each immutable profile and blocking transitions after unknown launches. Ordinary build and runtime share one profile so captured publication is never replaced between assertions.
 * @evidence contracts/e2e.md#preserved-coverage test_ttsx_failure_cleanup_pins_a_linked_run_index preserves nonzero status/missing-source diagnostic/single victim generation/literal sentinel/empty original index across a descriptor-retargeted cache child alias, distinct from the cache-root alias profile. test_ttsx_publishes_a_physical_root_for_a_dependency_whose_rootdir_is_a_symlink preserves VALUE output/two live manifest roots/native physical equality without asserting per-package association; test_ttsx_preserves_an_empty_nested_node_modules_cache_boundary preserves both cache-root observations/runtime marker/status and empty project cache. Flat/nested test_ttsx_runs_a_*_entry_whose_project_declares_no_rootdir preserve noEmit with absent rootDir/outDir, exact greeting/status and both independent adjacent JavaScript absence paths. Retains test_ttsx_executes_standard_decorators_at_esnext four emit/runtime pairs and all byte assertions; test_ttsx_standard_decorators_preserve_member_initialization ESM value/order; test_ttsx_runs_preserved_jsx_through_the_automatic_runtime HTML/config bytes; test_ttsx_compiles_a_forwarded_jsx_preserve_for_the_runtime both exact HTML outputs; test_ttsx_standard_decorators_reject_invalid_programs_before_effects five status/diagnostic/no-effect triples; test_ttsx_standard_decorators_preserve_cli_and_library_options three complete effects; and test_ttsx_decorator_export_discovery_never_removes_runtime_values complete effects plus 17/42 exports; and test_ttsx_register_executes_excluded_standard_decorators all four direct/public-register format outputs and statuses; test_ttsx_register_stops_diagnostics_before_entry_effects both diagnostic/status/marker matrices, initial empty cache and prior FIRST ordering; and test_ttsx_rejects_a_require_without_a_value original launcher rejection; test_ttsx_classifies_module_preserve_as_ecmascript_modules original ESM output; and test_ttsx_classifies_the_entry_by_a_forwarded_module_flag all six owned/excluded direct/response status and output pairs; test_ttsx_classifies_a_node_modules_package_type_over_the_project_module_option exact dependency/project values; test_runner_corpus_invalid_tsconfig_prevents_entry_execution diagnostic/location/no stdout effect/no marker; and test_ttsx_compiles_a_required_source_whose_project_lists_no_files fallback arguments=3; test_ttsx_emits_an_installed_package_root_whose_config_sets_no_emit_on_error installed-root arguments=3; and test_ttsx_builds_a_dependency_whose_config_sets_no_emit_on_error wrapped-7 project-built=true live manifest/cache witness; test_ttsx_follows_directory_references_nested_solutions_and_cycles exact entry=3 dependency=3; test_ttsx_selects_the_project_through_the_legacy_uppercase_p_flag ENTRY/explicit-runner-project pair; and test_ttsx_resolves_config_dir_paths_for_an_installed_package_root area-9; test_ttsx_runs_the_entry_as_the_main_module all six native main/argv/handled/exit/throw/rejection observations; and test_ttsx_runs_preserved_jsx_in_a_dependency_and_an_orphan both HTML outputs and independent failure inputs; test_ttsx_checks_a_typescript_file_the_program_generates_before_running_it exact typed-to-mistyped writes/status/value/root diagnostic/no-output transition; and test_ttsx_runs_a_source_file_the_entry_generates_at_runtime extensionless VALUE:42; and test_ttsx_preserves_custom_node_builtin_remaps child-local actual user hooks and both custom-remap/non-builtin-exact-strip values; and test_ttsx_runs_a_dependency_source_its_project_omits_with_that_project_options distinct same-name dep-b:3 owning-option witness. Actual surviving execution and donor removal remain pending.
 */
export function canonicalRuntimeLanguageProfiles(): Parameters<typeof runCanonicalRuntimeProfiles>[1] {
  const profiles: Parameters<typeof runCanonicalRuntimeProfiles>[1][number][] = [];
  // One tracked external island keeps physical targets outside the consumer
  // config ancestry; an in-root holding path would change orphan discovery.
  const linkedInputs = TestProject.tmpdir("ttsx-shared-external-file-inputs-");
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
  profiles.push({
    name: "public-runtime-user-builtin-remap-hooks",
    files: {
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", strict: true, outDir: "dist", rootDir: "src" }),
      "custom-hook.cjs": `
      const { registerHooks } = require("node:module");
      const url = "ttsx-custom:sqlite-boundary";
      registerHooks({
        resolve(specifier, context, nextResolve) {
          if (specifier === "node:sqlite") {
            return { format: "commonjs", shortCircuit: true, url };
          }
          if (specifier === "node:custom") {
            return { format: "commonjs", shortCircuit: true, url: "custom" };
          }
          return nextResolve(specifier, context);
        },
        load(candidate, context, nextLoad) {
          if (candidate === url) {
            return {
              format: "commonjs",
              shortCircuit: true,
              source: 'module.exports = { source: "custom-remap" };',
            };
          }
          if (candidate === "custom") {
            return {
              format: "commonjs",
              shortCircuit: true,
              source: 'module.exports = { source: "non-builtin-exact-strip" };',
            };
          }
          return nextLoad(candidate, context);
        },
      });
    `,
      "src/main.ts": `
      declare function require(specifier: "node:sqlite" | "node:custom"): {
        source: string;
      };
      console.log([
        require("node:sqlite").source,
        require("node:custom").source,
      ].join(","));
    `,
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root, env: { NODE_OPTIONS: `--require ${JSON.stringify(path.join(root, "custom-hook.cjs"))}` } });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "custom-remap,non-builtin-exact-strip");
    },
  });
  const omittedDependencyOptions = { target: "ES2022", module: "commonjs", types: [] };
  profiles.push({
    name: "public-runtime-omitted-same-name-dependency-own-options",
    files: {
      "package.json": JSON.stringify({ name: "workspace", private: true }),
      "app/tsconfig.json": JSON.stringify({ compilerOptions: omittedDependencyOptions, files: ["main.ts"] }),
      "app/main.ts": ['declare const require: (path: string) => {', '  identity: string;', '  decoratorArguments: number;', '};', 'const b = require("../dep/b/index.ts");', 'console.log(b.identity + ":" + b.decoratorArguments);', 'export {};', ""].join("\n"),
      "dep/tsconfig.json": JSON.stringify({ compilerOptions: { ...omittedDependencyOptions, experimentalDecorators: true }, files: ["a/index.ts"] }),
      "dep/a/index.ts": 'export const identity: string = "dep-a";\nexport const decoratorArguments: number = -1;\n',
      "dep/b/index.ts": ['let observed: number = 0;', 'function probe(...args: any[]): void {', '  observed = args.length;', '}', 'class Box {', '  @probe', '  method(): void {}', '}', 'export const identity: string = "dep-b";', 'export const decoratorArguments: number = observed;', 'export const box: Box = new Box();', ""].join("\n"),
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "-P", "app/tsconfig.json", "app/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "dep-b:3");
    },
  });
  profiles.push({
    name: "dynamic-esm-commonjs-js-specifier-tsx-rescue",
    files: {
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", strict: true, outDir: "dist", rootDir: "src", jsx: "react-jsx" }),
      ...FixtureFiles.read("ttsc/ttsx_commonjs_require_rescues_a_js_specifier_inside_a_dynamic_import/inputs-1"),
    },
    run: (root, _persistent, spawn) => {
      assert.equal(fs.existsSync(path.join(root, "src", "target.js")), false, "JS request has only the original TSX source behind it");
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/entry.mts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), '{"default":"RESCUED"}');
    },
  });
  profiles.push({
    name: "javascript-commonjs-import-keeps-node-require",
    files: {
      "package.json": `{ "type": "module", "private": true }\n`,
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "nodenext", strict: true, skipLibCheck: true, noEmit: true }, { include: ["*.ts", "*.d.cts"] }),
      "shared.ts": `export const value: string = "from-ts";\n`,
      "plain.cjs": `module.exports = { plain: 1 };\n`,
      "lib.cjs": [
        `const shared = require("./shared.ts").value;`,
        `const spelled = require("./shared.js").value;`,
        `delete require.cache[require.resolve("./plain.cjs")];`,
        `exports.value = [shared, spelled].join(",");`,
        `exports.properties = [typeof require.cache, typeof require.extensions, typeof require.resolve.paths].join(",");`,
        ``,
      ].join("\n"),
      "lib.d.cts": `export declare const value: string;\nexport declare const properties: string;\n`,
      "again.cjs": `module.exports = require("./lib.cjs");\n`,
      "again.d.cts": `export * from "./lib.cjs";\n`,
      "entry.ts": [
        `import lib from "./lib.cjs";`,
        `import { properties } from "./lib.cjs";`,
        `import { value } from "./again.cjs";`,
        `console.log(JSON.stringify({ properties, value, whole: lib.value }));`,
        ``,
      ].join("\n"),
    },
    run: (root, _persistent, spawn) => {
      const expected = { properties: "object,object,function", value: "from-ts,from-ts", whole: "from-ts,from-ts" };
      const failures: unknown[] = [];
      for (const [name, command, args] of [
        ["ttsx", TestProject.TTSX_BIN, ["--cwd", root, "entry.ts"]],
        ["register", process.execPath, ["--import", pathToFileURL(path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib", "register.js")).href, "entry.ts"]],
      ] as const) {
        const result = spawn(command, [...args], { cwd: root });
        try {
          assert.equal(result.status, 0, name + ": " + result.stderr);
          assert.deepEqual(JSON.parse(result.stdout.trim()), expected);
        } catch (cause) {
          failures.push(new Error(name + " CommonJS require assertions", { cause }));
        }
      }
      if (failures.length) throw new AggregateError(failures, "JavaScript CommonJS require properties");
    },
  });
  profiles.push({
    name: "commonjs-star-export-same-basename-owner-collision",
    files: FixtureFiles.read("ttsc/ttsx_exposes_a_package_star_export_by_its_own_names_beside_a_same_named_project_file/inputs-1"),
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "project:package");
    },
  });
  profiles.push({
    name: "node20-package-type-opposite-scopes",
    files: {
      "package.json": JSON.stringify({ name: "node20-cjs", version: "1.0.0" }),
      "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "node20", moduleResolution: "node16", strict: true, outDir: "lib", rootDir: "src" }, include: ["src"] }),
      "src/globals.d.ts": "declare const __dirname: string;\n",
      "src/main.ts": 'export {};\nconsole.log(typeof __dirname === "string" ? "node20-commonjs" : "wrong");\nvoid import("./esm/main.js");\n',
      "src/esm/package.json": JSON.stringify({ name: "node20-esm", version: "1.0.0", type: "module" }),
      "src/esm/main.ts": 'export {};\nconsole.log(import.meta.url.startsWith("file:") ? "node20-module" : "wrong");\n',
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(result.stdout.trim().split(/\r?\n/), ["node20-commonjs", "node20-module"]);
    },
  });
  profiles.push({
    name: "file-linked-entry-physical-module-package",
    files: FixtureFiles.read("ttsc/ttsx_classifies_a_symlinked_entry_from_the_target_package_type/inputs-1"),
    run: (root, persistent, spawn) => {
      const outside = path.join(persistent, "file-linked-esm-package");
      fs.mkdirSync(outside);
      fs.writeFileSync(path.join(outside, "package.json"), JSON.stringify({ name: "esm-tools", type: "module", version: "1.0.0" }), "utf8");
      fs.writeFileSync(path.join(outside, "tool.ts"), ['export const marker: string = "loaded-as-esm";', 'console.log(marker);', ""].join("\n"), "utf8");
      const entry = path.join(root, "tool.ts");
      // A failed native link is a failed prerequisite, never a successful profile
      // or a fabricated capability skip. The retained donor keeps its old guard.
      fs.symlinkSync(path.join(outside, "tool.ts"), entry, "file");
      assert.equal(fs.lstatSync(entry).isSymbolicLink(), true);
      assert.equal(fs.realpathSync.native(entry), fs.realpathSync.native(path.join(outside, "tool.ts")));
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "tool.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /loaded-as-esm/);
      assert.doesNotMatch(result.stderr, /Unexpected token 'export'|Cannot use import statement/, "the entry was classified from the link's package scope, not the target's");
    },
  });
  profiles.push({
    name: "commonjs-main-native-cache-under-import-preloads",
    files: {
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", strict: true, outDir: "dist", rootDir: "src" }),
      "src/main.ts": [
        `declare const require: any;`,
        `declare const module: any;`,
        `declare const __filename: string;`,
        `console.log(JSON.stringify({`,
        `  cache: typeof require.cache,`,
        `  shared: require.cache === require("node:module").createRequire(__filename).cache,`,
        `  dep: require("./dep.js").value,`,
        `  main: require.main === module,`,
        `}));`,
        ``,
      ].join("\n"),
      "src/dep.ts": `export const value: string = "dep";\n`,
      "preload.mjs": ``,
      "native-reference.cjs": `console.log(JSON.stringify({ cache: typeof require.cache, main: require.main === module, shared: require.cache === require("node:module").createRequire(__filename).cache }));\n`,
    },
    run: (root, _persistent, spawn) => {
      const preload = pathToFileURL(path.join(root, "preload.mjs")).href;
      const register = path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib", "register.js");
      const reference = spawn(process.execPath, ["--import", preload, "native-reference.cjs"], { cwd: root });
      assert.equal(reference.status, 0, reference.stderr);
      const native = JSON.parse(reference.stdout.trim()) as { cache: string; main: boolean; shared: boolean };
      assert.deepEqual(native, { cache: "object", main: true, shared: true });
      const expected = { cache: native.cache, dep: "dep", main: true, shared: native.shared };
      const failures: unknown[] = [];
      for (const [label, command, args, env] of [
        ["ttsx", TestProject.TTSX_BIN, ["src/main.ts"], { NODE_OPTIONS: `--import=${preload}` }],
        ["--import ttsc/register", process.execPath, ["--import", pathToFileURL(register).href, "src/main.ts"], {}],
        ["--import preload -r ttsc/register", process.execPath, ["--import", preload, "-r", register, "src/main.ts"], {}],
      ] as const) {
        const result = spawn(command, [...args], { cwd: root, env });
        try {
          assert.equal(result.status, 0, `${label}: ${result.stderr}`);
          assert.deepEqual(JSON.parse(result.stdout.trim()), expected, label);
        } catch (cause) {
          failures.push(new Error(label + " CommonJS main/cache assertions", { cause }));
        }
      }
      if (failures.length) throw new AggregateError(failures, "CommonJS main under import preload");
    },
  });
  profiles.push({
    name: "dependency-owned-commonjs-circular-module-graph",
    files: FixtureFiles.read("ttsc/ttsx_runs_a_dependency_with_a_circular_module_graph/inputs-1"),
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "combined:AB");
    },
  });
  profiles.push({
    name: "virtual-layout-mirrors-external-file-symlink",
    files: FixtureFiles.read("ttsc/ttsx_virtual_layout_mirrors_a_file_symlink_project_entry/inputs-1"),
    run: (root, persistent, spawn) => {
      const outside = path.join(linkedInputs, "mirror-file-target");
      assert.ok(path.relative(root, outside).startsWith(".." + path.sep), "physical target stays outside consumer config ancestry");
      fs.mkdirSync(outside);
      const target = path.join(outside, "linked.txt");
      fs.writeFileSync(target, "linked", "utf8");
      const entry = path.join(root, "linked.txt");
      fs.symlinkSync(target, entry, "file");
      assert.equal(fs.lstatSync(entry).isSymbolicLink(), true);
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "file-symlink-ok");
    },
  });
  profiles.push({
    name: "linked-entry-project-target-lowering-and-v8-map",
    files: FixtureFiles.read("ttsc/ttsx_runs_an_entry_that_is_itself_a_symlink/inputs-1"),
    run: (root, persistent, spawn) => {
      const outside = path.join(linkedInputs, "linked-entry-source");
      assert.ok(path.relative(root, outside).startsWith(".." + path.sep), "physical target stays outside consumer config ancestry");
      fs.mkdirSync(outside);
      fs.writeFileSync(path.join(outside, "clear.ts"), [
        `const ran: string = "ran-through-the-link";`,
        `console.log(ran);`,
        `function optional(value?: { answer: number }) { return value?.answer; }`,
        `console.log("native-optional=" + optional.toString().includes("?."));`,
        "",
      ].join("\n"), "utf8");
      fs.symlinkSync(path.join(outside, "clear.ts"), path.join(root, "clear.ts"), "file");
      const coverage = path.join(persistent, "linked-entry-v8-coverage");
      fs.mkdirSync(coverage);
      const run = runTtsxWithCoverage(root, "clear.ts", {}, spawn, coverage);
      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /ran-through-the-link/);
      assert.match(run.stdout, /(?:^|\r?\n)native-optional=false(?:\r?\n|$)/);
      const script = run.scriptEndingWith("clear.ts");
      assert.ok(script, "coverage must record the served clear.ts script");
      assert.ok(script.sourceMap !== null, "the served linked entry must carry a resolvable source map");
    },
  });
  const inlineThrower = (tag: string): string => [
    `declare const console: { log(value: unknown): void };`,
    ``,
    ``,
    `try {`,
    `  throw new Error("${tag}");`,
    `} catch (error) {`,
    `  console.log((error as Error).stack?.split("\\n")[1]?.trim());`,
    `}`,
    `export {};`,
    ``,
  ].join("\n");
  profiles.push({
    name: "forwarded-inline-map-included-and-excluded-stack",
    files: {
      "package.json": JSON.stringify({ name: "inlinemap", private: true }),
      "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "commonjs", strict: true, outDir: "dist", rootDir: "src", types: [] }, include: ["src"] }),
      "src/main.ts": inlineThrower("inside"),
      "outside.ts": inlineThrower("outside"),
    },
    run: (root, _persistent, spawn) => {
      const failures: Error[] = [];
      for (const entry of ["src/main.ts", "outside.ts"]) {
        const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "--inlineSourceMap", entry], { cwd: root });
        try {
          assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
          assert.match(result.stdout, new RegExp(`${entry.split("/").pop()!.replace(".", "\\.")}:5:\\d+`), entry);
        } catch (cause) {
          failures.push(new Error(entry + " forwarded inline map", { cause }));
        }
      }
      if (failures.length) throw new AggregateError(failures, "forwarded inline map assertions");
    },
  });
  const coverageOptions = { target: "ES2022", module: "commonjs", strict: true, sourceMap: true, outDir: "lib", rootDir: "src" };
  const coverageFiles: Record<string, string> = {
    "package.json": JSON.stringify({ private: true }),
    "tsconfig.json": JSON.stringify({ compilerOptions: coverageOptions, include: ["src"] }),
    "src/lib.ts": tallCommentLibrarySource(),
    "src/main.ts": ['import { used as rootUsed } from "./lib";', 'import { used as mappedUsed } from "dep-mapped";', 'import { used as forcedUsed } from "dep-forced";', "rootUsed(); mappedUsed(); forcedUsed();", ""].join("\n"),
  };
  for (const [name, sourceMap] of [["dep-mapped", true], ["dep-forced", false]] as const) {
    coverageFiles[`node_modules/${name}/package.json`] = JSON.stringify({ name, version: "1.0.0", exports: { ".": "./src/index.ts" } });
    coverageFiles[`node_modules/${name}/tsconfig.json`] = JSON.stringify({ compilerOptions: { ...coverageOptions, sourceMap }, include: ["src"] });
    coverageFiles[`node_modules/${name}/src/index.ts`] = tallCommentLibrarySource();
  }
  profiles.push({
    name: "entry-and-dependency-v8-map-true-false",
    files: coverageFiles,
    run: (root, persistent, spawn) => {
      const failures: Error[] = [];
      for (const sourceMap of [true, false]) {
        fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { ...coverageOptions, sourceMap }, include: ["src"] }));
        const recorder = path.join(persistent, `entry-dependency-coverage-${sourceMap}`);
        fs.mkdirSync(recorder);
        const run = runTtsxWithCoverage(root, "src/main.ts", {}, spawn, recorder);
        try { assert.equal(run.status, 0, run.stderr); } catch (cause) { failures.push(new Error(`root sourceMap=${sourceMap}`, { cause })); }
        for (const relative of ["src/lib.ts", "node_modules/dep-mapped/src/index.ts", "node_modules/dep-forced/src/index.ts"]) {
          try {
            const script = run.scriptEndingWith(relative.replaceAll("\\", "/"));
            assert.ok(script, `coverage must record ${relative}`);
            assert.notEqual(script.sourceMap, null, "source-map-cache.data must be present");
            const mapped = sourceMapSourcePath(script);
            assert.ok(mapped, "the inlined map must list a source path");
            assert.equal(physicalRealpath(mapped), physicalRealpath(path.join(root, relative)), "the map must name the original physical TS source");
            assert.equal(maxFunctionCount(script, "unused"), 0, "the never-called export must record zero executions");
            assert.ok(maxFunctionCount(script, "used") >= 1, "the called export must record at least one execution");
          } catch (cause) { failures.push(new Error(`sourceMap=${sourceMap}: ${relative}`, { cause })); }
        }
      }
      if (failures.length) throw new AggregateError(failures, "runtime coverage map assertions failed");
    },
  });
  profiles.push({
    name: "native-stack-entry-and-dependency-map-true-false",
    files: {
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({ compilerOptions: coverageOptions, include: ["src"] }),
      "src/boom.ts": tallCommentThrowerSource("boom", "entry boom"),
      "node_modules/built-dep/package.json": JSON.stringify({ name: "built-dep", version: "1.0.0", exports: { ".": "./src/index.ts" } }),
      "node_modules/built-dep/tsconfig.json": JSON.stringify({ compilerOptions: coverageOptions, include: ["src"] }),
      "node_modules/built-dep/src/index.ts": tallCommentThrowerSource("depBoom", "dependency boom"),
      "src/main.ts": [
        'import { boom } from "./boom";', 'import { depBoom } from "built-dep";',
        "const records: { name: string; threw: boolean; stack?: string }[] = [];",
        "let last: unknown;",
        'for (const [name, fn] of [["boom", boom], ["depBoom", depBoom]] as const) {',
        "  try { fn(); records.push({ name, threw: false }); }",
        "  catch (error) { last = error; console.error((error as Error).stack); records.push({ name, threw: true, stack: (error as Error).stack }); }",
        "}", "console.log(JSON.stringify(records));", "if (last !== undefined) throw last;", "",
      ].join("\n"),
    },
    run: (root, _persistent, spawn) => {
      const failures: Error[] = [];
      const fold = (value: string): string => {
        const slashed = value.replace(/\\/g, "/");
        return process.platform === "win32" ? slashed.toLowerCase() : slashed;
      };
      for (const sourceMap of [true, false]) {
        fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { ...coverageOptions, sourceMap }, include: ["src"] }));
        const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
        try {
          assert.notEqual(result.status, 0, "the actual rethrown error must fail the run");
          const records = JSON.parse(result.stdout.trim()) as { name: string; threw: boolean; stack?: string }[];
          assert.deepEqual(records.map(({ name, threw }) => ({ name, threw })), [{ name: "boom", threw: true }, { name: "depBoom", threw: true }]);
          for (const [name, relative] of [["boom", "src/boom.ts"], ["depBoom", "node_modules/built-dep/src/index.ts"]]) {
            try {
              const frame = `${name} (${physicalRealpath(path.join(root, relative!))}:${THROWER_THROW_LINE}:${THROWER_THROW_COLUMN})`;
              const stack = records.find((record) => record.name === name)?.stack ?? "";
              assert.ok(fold(stack).includes(fold(frame)), `stack must contain ${frame}\n${stack}`);
              assert.ok(fold(result.stderr).includes(fold(frame)), `stderr must contain ${frame}\n${result.stderr}`);
            } catch (cause) { failures.push(new Error(`sourceMap=${sourceMap}: ${name}`, { cause })); }
          }
        } catch (cause) { failures.push(new Error(`sourceMap=${sourceMap}: host`, { cause })); }
      }
      if (failures.length) throw new AggregateError(failures, "runtime stack map assertions failed");
    },
  });
  profiles.push({
    name: "forwarded-output-location-flags-top-level-isolation",
    files: FixtureFiles.read("ttsc/ttsx_forwarded_output_flags_create_nothing_in_the_project/inputs-1"),
    run: (root, _persistent, spawn) => {
      const names = fs.readdirSync(root).filter((name) => name !== "node_modules").sort();
      const failures: Error[] = [];
      for (const flags of [["--outDir", "distx"], ["--declaration", "--declarationDir", "typesx"], ["--incremental", "--tsBuildInfoFile", "state/run.tsbuildinfo"], ["--outFile", "bundle.js"]]) {
        const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, ...flags, "src/main.ts"], { cwd: root });
        const label = flags.join(" ");
        try {
          assert.equal(result.status, 0, `${label}: ${result.stderr}`);
          assert.equal(result.stdout.trim(), "ran", label);
          assert.deepEqual(fs.readdirSync(root).filter((name) => name !== "node_modules").sort(), names, `${label} wrote into the project`);
        } catch (cause) { failures.push(new Error(label + " runtime output isolation", { cause })); }
      }
      if (failures.length) throw new AggregateError(failures, "forwarded runtime output flags");
    },
  });
  profiles.push({
    name: "external-runtime-cache-and-public-cache-paths",
    files: FixtureFiles.read("ttsc/ttsx_ttsc_cache_dir_relocates_the_runtime_cache/inputs-1"),
    run: (root, _persistent, spawn) => {
      const cache = path.join(linkedInputs, "external-runtime-cache");
      assert.ok(path.relative(root, cache).startsWith(".." + path.sep), "caller cache stays outside the consumer");
      fs.mkdirSync(cache);
      assert.deepEqual(fs.readdirSync(cache), []);
      const env = { TTSC_CACHE_DIR: cache };
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root, env });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "relocated-runtime-cache");
      assert.equal(fs.existsSync(path.join(root, "node_modules")), false);
      assert.deepEqual(fs.readdirSync(path.join(cache, "ttsx", "project")), []);
      const paths = spawn(TestProject.TTSC_BIN, ["cache", "paths", "--json", "--cwd", root], { cwd: root, env });
      assert.equal(paths.status, 0, paths.stderr);
      assert.equal((JSON.parse(paths.stdout) as { cacheRoot: string }).cacheRoot, cache);
    },
  });
  profiles.push({
    name: "seeded-included-output-excluded-entry-ownership",
    files: FixtureFiles.read("ttsc/ttsx_runs_an_entry_the_project_include_excludes/inputs-1"),
    run: (root, _persistent, spawn) => {
      const compiled = spawn(TestProject.TTSC_BIN, ["--cwd", root, "-p", "tsconfig.json"], { cwd: root });
      assert.equal(compiled.status, 0, compiled.stderr);
      assert.deepEqual(fs.readdirSync(path.join(root, "lib")).sort(), ["index.js", "release.js"]);
      const failures: Error[] = [];
      for (const [entry, expected] of [["clear.ts", "cleared"], ["build/release.ts", "released"]] as const) {
        const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, entry], { cwd: root });
        try {
          assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
          assert.equal(result.stdout.trim(), expected);
        } catch (cause) { failures.push(new Error(entry + " excluded entry ownership", { cause })); }
      }
      try {
        assert.deepEqual(fs.readdirSync(path.join(root, "lib")).sort(), ["index.js", "release.js"]);
        assert.deepEqual(fs.readdirSync(root).filter((name) => name.startsWith(".ttsx-entry")), []);
      } catch (cause) { failures.push(new Error("seeded output and temporary config paths", { cause })); }
      if (failures.length) throw new AggregateError(failures, "included output and excluded entry ownership");
    },
  });
  profiles.push({
    name: "mixed-preload-order-program-tail-cwd-marker",
    files: {
      "app/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "app/a.cjs": `globalThis.__ttsxPreload = "loaded"; console.log("PRELOAD a.cjs");\n`,
      "app/b.cjs": `console.log("PRELOAD b.cjs");\n`,
      "app/a.ts": `console.log("PRELOAD a.ts");\n`,
      "app/c.tsx": `console.log("PRELOAD c.tsx");\n`,
      "app/after.cjs": `console.log("UNEXPECTED POST-ENTRY PRELOAD");\n`,
      "app/node_modules/@scope/preload/index.js": `globalThis.__ttsxScopedPreload = "scoped";\n`,
      "app/node_modules/plain-preload/package.json": JSON.stringify({ name: "plain-preload", version: "1.0.0" }),
      "app/node_modules/plain-preload/register.js": `globalThis.__ttsxSubpathPreload = "subpath";\n`,
      "app/src/main.ts": `declare const process: { argv: string[]; cwd(): string; env: { TTSX_MARKER?: string } }; declare function require(name: string): { writeFileSync(file: string, text: string): void }; const cjsSmoke: string = \"runner-ok\"; const marker = process.env.TTSX_MARKER; if (!marker) throw new Error("missing marker path"); require("node:fs").writeFileSync(marker, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), executed: true })); console.log(JSON.stringify({ entry: "ENTRY", cjsSmoke, preload: (globalThis as Record<string, unknown>).__ttsxPreload, scoped: (globalThis as Record<string, unknown>).__ttsxScopedPreload, subpath: (globalThis as Record<string, unknown>).__ttsxSubpathPreload, argv: process.argv.slice(2) }));\n`,
    },
    run: (parent, _persistent, spawn) => {
      const root = path.join(parent, "app");
      const compilerFlags = ["--strict", "--pretty", "--target", "es2020", "--module", "commonjs"];
      const flags = ["--require=./a.ts", "-r=./a.cjs", "-r", "./c.tsx", "--require", "./b.cjs", "-r", "@scope/preload", "--require", "plain-preload/register"];
      const tail = ["generate", "--input", "X", "--output", "Y", "--help", "-h", "--version", "-v", "--watch", "--build", "-r", "./after.cjs", "a", "--", "b", "--mode", "probe", "alpha", "beta"];
      const marker = path.join(root, "runner-marker.json");
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, ...compilerFlags, ...flags, "src/main.ts", "--", ...tail], { cwd: parent, env: { TTSX_MARKER: marker } });
      assert.equal(result.status, 0, result.stderr);
      assert.doesNotMatch(result.stdout + result.stderr, /entry file is required|Unknown compiler option|UNEXPECTED POST-ENTRY PRELOAD/i);
      const lines = result.stdout.trim().split(/\r?\n/);
      assert.deepEqual(lines.slice(0, -1), ["PRELOAD a.ts", "PRELOAD a.cjs", "PRELOAD c.tsx", "PRELOAD b.cjs"]);
      assert.deepEqual(JSON.parse(lines.at(-1)!), { entry: "ENTRY", cjsSmoke: "runner-ok", preload: "loaded", scoped: "scoped", subpath: "subpath", argv: tail });
      const record = JSON.parse(fs.readFileSync(marker, "utf8"));
      assert.deepEqual(record, { argv: tail, cwd: fs.realpathSync(root), executed: true });
      assert.equal(path.basename(record.cwd), "app");
    },
  });
  profiles.push({
    name: "javascript-main-import-preload-requires-typed-leaf",
    files: {
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", strict: true, outDir: "dist", rootDir: "src" }),
      "main.cjs": [`const dep = require("./src/dep.js");`, `console.log(JSON.stringify({ main: require.main === module, value: dep.value }));`, ``].join("\n"),
      "src/dep.ts": [`declare const require: any;`, `export const value: string = "dep+" + require("./leaf").leaf;`, ``].join("\n"),
      "src/leaf.ts": `export const leaf: string = "leaf";\n`,
      "preload.mjs": ``,
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(process.execPath, ["--import", pathToFileURL(path.join(root, "preload.mjs")).href, "-r", path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib", "register.js"), "main.cjs"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout.trim()), { main: true, value: "dep+leaf" });
    },
  });
  profiles.push({
    name: "unchecked-required-root-type-gate-before-effects",
    files: FixtureFiles.read("ttsc/ttsx_stops_on_a_type_error_in_a_required_source_no_checked_build_covered/inputs-1"),
    run: (root, _persistent, spawn) => {
      linkTtscPackage(root);
      const marker = path.join(root, "effect-ran.txt");
      const failures: unknown[] = [];
      for (const [lane, command, args] of [["ttsx", TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"]], ["register", process.execPath, ["--require", TTSX_REGISTER, "src/main.ts"]]] as const) {
        fs.rmSync(marker, { force: true });
        const result = spawn(command, [...args], { cwd: root, env: { TTSX_ROOT_MARKER: marker } });
        try {
          assert.notEqual(result.status, 0, `${lane}: ${result.stdout}`);
          assert.match(result.stderr, /root check failed for .*effect\.ts/);
          assert.match(result.stderr, /Type 'string' is not assignable to type 'number'/);
          assert.equal(fs.existsSync(marker), false, `${lane} ran the root`);
        } catch (cause) { failures.push(new Error(lane, { cause })); }
      }
      try { assert.deepEqual(fs.readdirSync(root).filter((name) => name.startsWith(".ttsx-")), []); } catch (cause) { failures.push(cause); }
      if (failures.length) throw new AggregateError(failures, "required root diagnostic gates failed");
    },
  });
  profiles.push({
    name: "decorated-orphan-requested-source-not-same-basename-helper",
    files: {
      "package.json": '{"type":"module"}',
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "esnext", rootDir: "src", outDir: "dist" }),
      "src/main.ts": 'const name: string = "../scripts/index.ts"; const dep = await import(name); console.log(dep.answer, dep.own); export {};',
      "scripts/index.ts": 'import { answer } from "./internal/index";\n' + STANDARD_DECORATOR_SOURCE + "\nexport { answer }; export const own = 1;",
      "scripts/internal/index.ts": "export const answer = 42;",
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT + "\n42 1");
    },
  });
  const orphanEnumValues = "export const enum Value { Entry = 42 }\nexport interface OnlyType { value: number }";
  const enumShapes = [{ name: "dep-direct", barrel: false }, { name: "dep-barrel", barrel: true }];
  const enumFiles: Record<string, string> = FixtureFiles.read("ttsc/ttsx_standard_decorator_orphans_expose_reexported_const_enums/inputs-1");
  const enumEntry = ['declare const process: { exitCode: number };', 'export {};'];
  for (const shape of enumShapes) {
    const directory = "node_modules/" + shape.name;
    enumFiles[directory + "/package.json"] = JSON.stringify({ name: shape.name, type: "commonjs", exports: "./index.ts" });
    enumFiles[directory + "/index.ts"] = STANDARD_DECORATOR_SOURCE + (shape.barrel ? '\nexport * from "./values";' : orphanEnumValues);
    enumFiles[directory + "/values.ts"] = orphanEnumValues;
    enumEntry.push(`console.log("BEGIN:${shape.name}");`, `try { const name: string = ${JSON.stringify(shape.name)}; const dep = await import(name); console.log(dep.Value.Entry, dep.Value === dep.default.Value, Object.hasOwn(dep, "OnlyType")); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }`, `console.log("END:${shape.name}");`);
  }
  enumFiles["src/main.ts"] = enumEntry.join("\n");
  profiles.push({
    name: "decorated-orphan-direct-barrel-const-enum-retained-cache",
    files: enumFiles,
    run: (root, _persistent, spawn) => {
      const cache = path.join(linkedInputs, "decorator-enum-cache");
      fs.mkdirSync(cache);
      assert.deepEqual(fs.readdirSync(cache), []);
      const failures: unknown[] = [];
      for (const phase of ["cold", "warm"]) {
        const result = spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root, env: { TTSC_CACHE_DIR: cache } });
        const lines = result.stdout.trim().split(/\r?\n/);
        for (const shape of enumShapes) {
          try {
            const begin = lines.indexOf("BEGIN:" + shape.name);
            const end = lines.indexOf("END:" + shape.name);
            assert.ok(begin >= 0 && end > begin, phase + ":" + shape.name);
            assert.equal(lines.slice(begin + 1, end).join("\n"), STANDARD_DECORATOR_OUTPUT + "\n42 true false", phase + ":" + shape.name);
          } catch (cause) { failures.push(cause); }
        }
        try { assert.equal(result.status, 0, result.stderr); } catch (cause) { failures.push(cause); }
      }
      if (failures.length) throw new AggregateError(failures, "orphan enum export batch failed");
    },
  });
  profiles.push({
    name: "decorated-orphan-imported-enum-mutations-retain-lowering",
    files: {
      "package.json": '{"type":"module"}',
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "esnext", rootDir: "src", outDir: "dist" }),
      "src/main.ts": 'const name: string = "dep"; const dep = await import(name); console.log(dep.answer); export {};',
      "node_modules/dep/src/index.ts": 'import { Value } from "./enum";\n' + STANDARD_DECORATOR_SOURCE + "\nexport const answer = Value.Entry;",
    },
    run: (root, _persistent, spawn) => {
      const cache = path.join(linkedInputs, "decorator-imported-enum-cache");
      fs.mkdirSync(cache);
      assert.deepEqual(fs.readdirSync(cache), []);
      const decorated = fs.readFileSync(path.join(root, "node_modules/dep/src/index.ts"));
      const failures: unknown[] = [];
      for (const [type, answer] of [["module", 1], ["module", 2], ["commonjs", 3], ["commonjs", 4]] as const) {
        TestProject.writeFiles(root, {
          "node_modules/dep/package.json": JSON.stringify({ name: "dep", type, exports: "./src/index.ts" }),
          "node_modules/dep/src/enum.ts": `export const enum Value { Entry = ${answer} }`,
        });
        const result = spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root, env: { TTSC_CACHE_DIR: cache } });
        try { assert.equal(result.status, 0, result.stderr); } catch (cause) { failures.push(cause); }
        try { assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT + "\n" + answer); } catch (cause) { failures.push(cause); }
        try { assert.deepEqual(fs.readFileSync(path.join(root, "node_modules/dep/src/index.ts")), decorated); } catch (cause) { failures.push(cause); }
      }
      if (failures.length) throw new AggregateError(failures, "standard_decorators_in_orphans_do_not_cache_imported_values assertions failed");
    },
  });
  const ownedModules = Number(process.versions.node.split(".")[0]) >= 24 ? ["commonjs", "esnext"] : ["commonjs"];
  const ownedShapes = ownedModules.flatMap((module) => [false, true].map((preserve) => ({ module, preserve, name: "dep-" + module + "-" + preserve })));
  const ownedFiles: Record<string, string> = FixtureFiles.read("ttsc/ttsx_decorator_orphan_reexports_honor_the_owning_project/inputs-1");
  const ownedEntry = ['declare const process: { exitCode: number };', 'export {};'];
  for (const shape of ownedShapes) {
    const directory = "node_modules/" + shape.name;
    ownedFiles[directory + "/package.json"] = JSON.stringify({ name: shape.name, type: "commonjs", exports: "./index.ts" });
    ownedFiles[directory + "/index.ts"] = STANDARD_DECORATOR_SOURCE + '\nexport * from "./values/entry";';
    ownedFiles[directory + "/values/package.json"] = JSON.stringify({ type: shape.module === "esnext" ? "module" : "commonjs" });
    ownedFiles[directory + "/values/tsconfig.json"] = TestProject.tsconfig({ target: "ES2022", module: shape.module, rootDir: ".", outDir: "lib", preserveConstEnums: shape.preserve }, { include: ["entry.ts"] });
    ownedFiles[directory + "/values/entry.ts"] = 'console.log("values-loaded"); export const enum Value { Entry = 42 } export const actual = 17;';
    ownedEntry.push(`console.log("BEGIN:${shape.name}");`, `try { const name: string = ${JSON.stringify(shape.name)}; const dep = await import(name); console.log(Object.hasOwn(dep, "Value"), Object.hasOwn(dep.default, "Value"), dep.Value?.Entry ?? "missing", dep.actual); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }`, `console.log("END:${shape.name}");`);
  }
  ownedFiles["src/main.ts"] = ownedEntry.join("\n");
  profiles.push({
    name: "decorated-orphan-reexports-owned-project-preserve-policy",
    files: ownedFiles,
    run: (root, _persistent, spawn) => {
      const cache = path.join(linkedInputs, "decorator-owned-reexport-cache");
      fs.mkdirSync(cache);
      assert.deepEqual(fs.readdirSync(cache), []);
      const failures: unknown[] = [];
      for (const phase of ["cold", "warm"]) {
        const result = spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root, env: { TTSC_CACHE_DIR: cache } });
        const lines = result.stdout.trim().split(/\r?\n/);
        for (const shape of ownedShapes) {
          try {
            const begin = lines.indexOf("BEGIN:" + shape.name);
            const end = lines.indexOf("END:" + shape.name);
            assert.ok(begin >= 0 && end > begin, phase + ":" + shape.name);
            const output = lines.slice(begin + 1, end);
            assert.ok(output.join("\n").includes(STANDARD_DECORATOR_OUTPUT), phase + ":" + shape.name);
            assert.equal(output.filter((line) => line === "values-loaded").length, 1, phase + ":" + shape.name);
            assert.equal(output.at(-1), `${shape.preserve} ${shape.preserve} ${shape.preserve ? 42 : "missing"} 17`, phase + ":" + shape.name);
          } catch (cause) { failures.push(cause); }
        }
        try { assert.equal(result.status, 0, result.stderr); } catch (cause) { failures.push(cause); }
      }
      if (failures.length) throw new AggregateError(failures, "owned decorator reexport batch failed");
    },
  });
  const barrelFiles: Record<string, string> = FixtureFiles.read("ttsc/ttsx_decorated_barrels_keep_nested_exports_with_emit_options/inputs-1");
  const barrelScenarios: string[] = [];
  const barrelEntry = ["declare const process: { exitCode: number };", "export {};"];
  for (const owned of [false, true]) {
    for (const rewrite of [false, true]) {
      for (const helpers of [false, true]) {
        const name = `dep-${Number(owned)}${Number(rewrite)}${Number(helpers)}`;
        const directory = `node_modules/${name}`;
        barrelScenarios.push(name);
        barrelFiles[`${directory}/package.json`] = JSON.stringify({ name, type: "commonjs", exports: "./index.ts" });
        if (owned) barrelFiles[`${directory}/tsconfig.json`] = TestProject.tsconfig({
          target: "ESNext", module: "commonjs", rootDir: ".", outDir: "lib", importHelpers: helpers, rewriteRelativeImportExtensions: rewrite,
        }, { include: ["index.ts"] });
        barrelFiles[`${directory}/index.ts`] = STANDARD_DECORATOR_SOURCE + '\nexport * from "./values/entry";';
        barrelFiles[`${directory}/values/tsconfig.json`] = TestProject.tsconfig({
          target: "ES2022", module: "commonjs", rootDir: ".", outDir: "lib", importHelpers: helpers, rewriteRelativeImportExtensions: rewrite,
        }, { include: ["*.ts"] });
        barrelFiles[`${directory}/values/entry.ts`] = `export const actual = 17; export * from "./nested${rewrite ? ".ts" : ""}";`;
        barrelFiles[`${directory}/values/nested.ts`] = "export let nested = 42; export function change() { nested = 43; }";
        barrelEntry.push(`console.log("BEGIN:${name}");`,
          `try { const name: string = ${JSON.stringify(name)}; const dep = await import(name); console.log(dep.actual, dep.nested, dep.default.nested); dep.change(); console.log(dep.default.nested); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }`,
          `console.log("END:${name}");`);
      }
    }
  }
  barrelFiles["src/main.ts"] = barrelEntry.join("\n");
  profiles.push({
    name: "decorated-nested-barrel-owned-rewrite-helper-options",
    files: barrelFiles,
    run: (root, _persistent, spawn) => {
      const tslibRoot = path.dirname(createRequire(import.meta.url).resolve("tslib/package.json"));
      TestProject.copyDirectory(tslibRoot, path.join(root, "node_modules/tslib"));
      const result = spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root });
      const lines = result.stdout.trim().split(/\r?\n/);
      const failures: unknown[] = [];
      for (const name of barrelScenarios) {
        try {
          const begin = lines.indexOf(`BEGIN:${name}`);
          const end = lines.indexOf(`END:${name}`);
          assert.ok(begin >= 0 && end > begin, name);
          assert.equal(lines.slice(begin + 1, end).join("\n"), STANDARD_DECORATOR_OUTPUT + "\n17 42 42\n43", name);
        } catch (error) { failures.push(error); }
      }
      try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, "decorated export option profiles failed");
    },
  });
  const inlineText = '\n__exportStar(require("./ghost"), exports);\n';
  const memberText = '\ntslib_1.__exportStar(require("./ghost"), exports);\n';
  const inertFiles: Record<string, string> = {
    "package.json": '{"type":"module"}',
    "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "esnext", rootDir: "src", outDir: "dist" }),
    "src/main.ts": 'const name: string = "dep"; const dep = await import(name); console.log(JSON.stringify({ actual: dep.actual, defaultActual: dep.default.actual, inlineText: dep.inlineText, memberText: dep.memberText, ghost: Object.hasOwn(dep, "ghost") || Object.hasOwn(dep.default, "ghost"), hidden: Object.hasOwn(dep.default, "hidden") })); export {};',
    "node_modules/dep/package.json": '{"name":"dep","type":"commonjs","exports":"./index.ts"}',
    "node_modules/dep/index.ts": STANDARD_DECORATOR_SOURCE + 'const marker = /`/; const ratio = 8 / 2 / 2;\nimport * as tslib from "tslib";\ndeclare function require(name: string): any; declare const exports: any;\n(function(){ tslib.__exportStar(require("./values/entry"), exports); })();\nif (false) tslib.__exportStar(require("./hidden"), exports);',
    "node_modules/dep/hidden.ts": 'throw new Error("must-not-execute"); export const hidden = 42;',
    "node_modules/dep/values/tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", rootDir: ".", outDir: "lib" }, { include: ["*.ts"] }),
    "node_modules/dep/values/entry.ts": 'const marker = /`/; const ratio = 8 / 2 / 2;\nexport * from "./nested";\nexport const inlineText = `' + inlineText + '`;\nexport const memberText = `' + memberText + '`;',
    "node_modules/dep/values/nested.ts": 'export const actual = 17;',
    "node_modules/dep/values/ghost.ts": 'throw new Error("inert text executed"); export const ghost = 42;',
  };
  profiles.push({
    name: "decorated-barrel-native-values-and-inert-helper-text",
    files: inertFiles,
    run: (root, _persistent, spawn) => {
      const tslibRoot = path.dirname(createRequire(import.meta.url).resolve("tslib/package.json"));
      TestProject.copyDirectory(tslibRoot, path.join(root, "node_modules", "tslib"));
      const result = spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      const lines = result.stdout.trim().split(/\r?\n/);
      assert.equal(lines.slice(0, -1).join("\n"), STANDARD_DECORATOR_OUTPUT);
      assert.deepEqual(JSON.parse(lines.at(-1)!), { actual: 17, defaultActual: 17, inlineText, memberText, ghost: false, hidden: false });
    },
  });
  profiles.push({
    name: "javascript-entry-refuses-all-original-build-policy-options",
    files: {
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", strict: true, outDir: "dist", rootDir: "src" }),
      ...FixtureFiles.read("ttsc/ttsx_refuses_build_options_before_a_javascript_entry/inputs-1"),
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--strict", "-P", "tsconfig.json", "--no-plugins", "@args.txt", "script.js"], { cwd: root });
      assert.equal(result.status, 2);
      for (const option of ["--project", "--no-plugins", "--strict", "@args.txt"]) assert.match(result.stderr, new RegExp(`ttsx: .*${option}`));
      assert.match(result.stderr, /script\.js is JavaScript/);
      assert.doesNotMatch(result.stdout, /ran/);
    },
  });
  profiles.push({
    name: "forwarded-strict-overrides-disabled-owning-project-policy",
    files: {
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", strict: false, outDir: "dist", rootDir: "src" }),
      ...FixtureFiles.read("ttsc/ttsx_forwards_an_unknown_flag_to_tsgo/inputs-1"),
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "--strict", "src/main.ts"], { cwd: root });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /is possibly .?null/i);
    },
  });
  profiles.push({
    name: "excluded-invalid-entry-reports-source-and-suppresses-effects",
    files: FixtureFiles.read("ttsc/ttsx_reports_a_type_error_in_an_entry_the_project_include_excludes/inputs-1"),
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "clear.ts"], { cwd: root });
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout.includes("must-not-run"), false);
      const output = `${result.stderr}${result.stdout}`;
      assert.equal(output.includes("clear.ts"), true, output);
      assert.equal(output.includes("emitted entry not found"), false, output);
    },
  });
  profiles.push({
    name: "excluded-entry-keeps-owning-nodenext-commonjs-options",
    files: FixtureFiles.read("ttsc/ttsx_runs_an_excluded_entry_under_the_project_compiler_options/inputs-1"),
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "clear.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "aliased cjs");
    },
  });
  profiles.push({
    name: "public-launcher-missing-entry-status-and-name",
    files: {},
    run: (root, _persistent, spawn) => {
      assert.equal(fs.existsSync(path.join(root, "missing-entry.ts")), false);
      const result = spawn(TestProject.TTSX_BIN, ["missing-entry.ts"], { cwd: root });
      assert.equal(result.status, 2);
      assert.match(result.stderr, /ttsx: entry not found:/);
      assert.match(result.stderr, /missing-entry\.ts/);
    },
  });
  profiles.push({
    name: "installed-omitted-root-keeps-legacy-options-without-type-gate",
    files: FixtureFiles.read("ttsc/ttsx_emits_an_installed_package_root_its_own_build_omits_without_a_type_gate/inputs-1"),
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "arguments=3");
    },
  });
  profiles.push({
    name: "foreign-own-diagnostics-do-not-block-served-v8-source-map",
    files: FixtureFiles.read("ttsc/ttsx_dependency_own_type_diagnostics_do_not_fail_the_run_while_inlining_its_map/inputs-1"),
    run: (root, persistent, spawn) => {
      const coverage = path.join(persistent, "foreign-diagnostic-map-coverage");
      fs.mkdirSync(coverage);
      const run = runTtsxWithCoverage(root, "src/main.ts", {}, spawn, coverage);
      assert.equal(run.status, 0, `a dependency's own type diagnostics must not fail the run\n${run.stderr}`);
      const script = run.scriptEndingWith("index.ts");
      assert.ok(script, "coverage must record the served dependency script");
      assert.ok(script.sourceMap !== null, "the dependency's map must still inline (data present)");
      const mapped = sourceMapSourcePath(script);
      const real = physicalRealpath(path.join(root, "node_modules", "built-dep", "src", "index.ts"));
      assert.ok(mapped, "the inlined map must list a source path");
      const fold = (value: string): string => process.platform === "win32" ? value.toLowerCase() : value;
      assert.equal(fold(path.normalize(mapped)), fold(real), "the map's source must be the dependency's real absolute index.ts");
    },
  });
  profiles.push({
    name: "workspace-link-and-consumer-diagnostics-gate-entry-and-clean-output",
    files: FixtureFiles.read("ttsc/ttsx_fails_at_the_compile_gate_on_a_type_error_in_an_imported_workspace_package/inputs-1"),
    run: (root, _persistent, spawn) => {
      fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
      const target = path.join(root, "packages", "ws-dep");
      const alias = path.join(root, "node_modules", "ws-dep");
      fs.symlinkSync(target, alias, "junction");
      assert.equal(fs.lstatSync(alias).isSymbolicLink(), true);
      assert.equal(fs.realpathSync.native(alias), fs.realpathSync.native(target));
      const marker = path.join(root, "type-error-marker.txt");
      const cache = path.join(root, ".ttsx-cache");
      assert.equal(fs.existsSync(marker), false);
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "--cache-dir", cache, "src/main.ts"], { cwd: root, env: { TTSX_MARKER: marker } });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /ws-dep[\\/]src[\\/]index\.ts/);
      assert.equal(result.stdout.trim(), "");
      assert.match(result.stderr, /project check failed/);
      assert.match(result.stderr, /Type 'number' is not assignable to type 'string'/);
      assert.match(result.stderr, /Type 'string' is not assignable to type 'number'/);
      assert.doesNotMatch(result.stdout, /should-not-run/);
      assert.equal(fs.existsSync(marker), false);
      const projectCache = path.join(cache, "project");
      assert.equal(fs.existsSync(projectCache), true);
      assert.deepEqual(fs.readdirSync(projectCache), []);
    },
  });
  const twinConfig = (exclude: string[]): string => JSON.stringify({
    compilerOptions: { target: "ES2022", module: "commonjs", strict: true, jsx: "react-jsx", outDir: "lib", rootDir: "src", types: [] },
    include: ["src"], exclude,
  });
  profiles.push({
    name: "same-stem-ts-tsx-native-runtime-and-positional-emit-selection",
    files: {
      "package.json": JSON.stringify({ name: "twins", private: true }),
      "tsconfig.json": twinConfig([]),
      "src/twin.ts": `export const twin: string = "from ts";\nconsole.log(twin);\n`,
      "src/twin.tsx": `export const twin: string = "from tsx";\nconsole.log(twin);\n`,
      "src/main.ts": `import "./twin";\n`,
    },
    run: (root, _persistent, spawn) => {
      const failures: unknown[] = [];
      for (const entry of ["src/main.ts", "src/twin.ts"]) {
        const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, entry], { cwd: root });
        try { assert.equal(result.status, 0, `${entry}: ${result.stderr}`); } catch (cause) { failures.push(cause); }
        try { assert.equal(result.stdout.trim(), "from ts", entry); } catch (cause) { failures.push(cause); }
      }
      const emitted = spawn(TestProject.TTSC_BIN, ["--cwd", root, "src/twin.ts"], { cwd: root });
      try { assert.equal(emitted.status, 0, `${emitted.stdout}${emitted.stderr}`); } catch (cause) { failures.push(cause); }
      const output = emitted.stdout.trim().split(/\r?\n/).pop()!;
      try { assert.match(fs.readFileSync(path.resolve(root, output), "utf8"), /from ts/); } catch (cause) { failures.push(cause); }
      TestProject.writeFiles(root, { "tsconfig.json": twinConfig(["src/twin.ts", "src/main.ts"]) });
      const tsx = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/twin.tsx"], { cwd: root });
      try { assert.equal(tsx.status, 0, tsx.stderr); } catch (cause) { failures.push(cause); }
      try { assert.equal(tsx.stdout.trim(), "from tsx"); } catch (cause) { failures.push(cause); }
      if (failures.length) throw new AggregateError(failures, "serves_a_source_whose_twin_has_another_typescript_extension assertions failed");
    },
  });
  profiles.push({
    name: "volume-root-files-list-serves-cross-directory-config-from-emit",
    files: FixtureFiles.read("ttsc/ttsx_serves_a_files_listed_source_outside_the_tsconfig_directory/inputs-1"),
    run: (root, _persistent, spawn) => {
      fs.writeFileSync(path.join(root, "loader", "tsconfig.json"), JSON.stringify({
        compilerOptions: {
          allowImportingTsExtensions: true, module: "ESNext", moduleResolution: "bundler",
          outDir: path.join(root, "loader", "out"), rewriteRelativeImportExtensions: true,
          rootDir: path.parse(root).root.replace(/\\/g, "/"), skipLibCheck: true, strict: false, target: "ES2022",
        },
        files: [path.join(root, "loader", "run.ts"), path.join(root, "config", "app.config.ts")],
      }), "utf8");
      const result = spawn(TestProject.TTSX_BIN, ["--project", path.join(root, "loader", "tsconfig.json"), "--cwd", path.join(root, "loader"), "--no-plugins", path.join(root, "loader", "run.ts")], { cwd: path.join(root, "loader") });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout.trim()), { token: "config-served-from-emit" });
    },
  });
    const referenceEntryProbe = [
      `let observed: number = 0;`,
      `function probe(...args: any[]): void {`,
      `  observed = args.length;`,
      `}`,
      `class Box {`,
      `  @probe`,
      `  method(): void {}`,
      `}`,
      `new Box();`,
      `console.log("arguments=" + observed);`,
      `export {};`,
      ``,
    ].join("\n");
    const referenceRuntimeOptions = {
      target: "ES2022",
      module: "commonjs",
      strict: true,
      types: [],
    };
  profiles.push({
    name: "solution-references-select-app-node-and-uncontained-public-routes",
    files: {
      "package.json": JSON.stringify({ name: "solution", private: true }),
      "tsconfig.json": JSON.stringify({
        files: [],
        references: [
          { path: "./tsconfig.app.json" },
          { path: "./tsconfig.node.json" },
        ],
      }),
      "tsconfig.app.json": JSON.stringify({
        compilerOptions: { ...referenceRuntimeOptions, experimentalDecorators: true },
        include: ["src"],
      }),
      "tsconfig.node.json": JSON.stringify({
        compilerOptions: referenceRuntimeOptions,
        include: ["vite.config.ts"],
      }),
      "src/main.ts": referenceEntryProbe,
      "vite.config.ts": referenceEntryProbe,
      "scripts/loose.ts": `console.log("loose ran");\nexport {};\n`,
    },
    run: (root, _persistent, spawn) => {
      linkTtscPackage(root);
      const failures: unknown[] = [];

    for (const [label, command, args, expected] of [
      [
        "entry",
        TestProject.TTSX_BIN,
        ["--cwd", root, "src/main.ts"],
        "arguments=3",
      ],
      [
        "register",
        process.execPath,
        ["--require", TTSX_REGISTER, "src/main.ts"],
        "arguments=3",
      ],
      [
        "node config",
        TestProject.TTSX_BIN,
        ["--cwd", root, "vite.config.ts"],
        "arguments=2",
      ],
      [
        "uncontained",
        TestProject.TTSX_BIN,
        ["--cwd", root, "scripts/loose.ts"],
        "loose ran",
      ],
    ] as const) {
      const result = spawn(command, [...args], { cwd: root });
      try { assert.equal(result.status, 0, `${label}: ${result.stderr}`); assert.equal(result.stdout.trim(), expected, label); } catch (cause) { failures.push(cause); }
    }
      if (failures.length) throw new AggregateError(failures, "referenced owning project public routes failed");
    },
  });
    const generatedReferenceProbe = (name: string): string =>
      [
        `let observed: number = 0;`,
        `function probe(...args: any[]): void {`,
        `  observed = args.length;`,
        `}`,
        `class Box {`,
        `  @probe`,
        `  method(): void {}`,
        `}`,
        `new Box();`,
        `export const ${name}: number = observed;`,
        ``,
      ].join("\n");
    const generatedReferenceOptions = {
      target: "ES2022",
      module: "commonjs",
      strict: true,
      types: [],
    };
  profiles.push({
    name: "runtime-generated-app-source-refreshes-referenced-membership",
    files: {
      "package.json": JSON.stringify({ name: "solution", private: true }),
      "tsconfig.json": JSON.stringify({
        files: [],
        references: [
          { path: "./tsconfig.app.json" },
          { path: "./tsconfig.node.json" },
        ],
      }),
      "tsconfig.app.json": JSON.stringify({
        compilerOptions: { ...generatedReferenceOptions, experimentalDecorators: true },
        include: ["src"],
      }),
      "tsconfig.node.json": JSON.stringify({
        compilerOptions: generatedReferenceOptions,
        include: ["tools"],
      }),
      "src/existing.ts": generatedReferenceProbe("existing"),
      "tools/run.ts": [
        `declare const require: (id: string) => any;`,
        `declare const __dirname: string;`,
        `const fs = require("node:fs");`,
        `const path = require("node:path");`,
        `const { existing } = require("../src/existing.ts");`,
        `fs.writeFileSync(`,
        `  path.join(__dirname, "..", "src", "generated.ts"),`,
        `  ${JSON.stringify(generatedReferenceProbe("generated"))},`,
        `);`,
        `const { generated } = require("../src/generated.ts");`,
        `console.log("existing=" + existing + " generated=" + generated);`,
        `export {};`,
        ``,
      ].join("\n"),
    },
    run: (root, _persistent, spawn) => {
      assert.equal(fs.existsSync(path.join(root, "src/generated.ts")), false);

    const result = spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "tools/run.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "existing=3 generated=3");
    },
  });
  profiles.push({
    name: "public-no-plugins-bypasses-configured-missing-transform",
    files: FixtureFiles.read("ttsc/ttsx_no_plugins_skips_plugin_loading/inputs-1"),
    run: (root, _persistent, spawn) => {
      const failures: unknown[] = [];
      const withPlugins = spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root });
      try { assert.notEqual(withPlugins.status, 0, "ttsx without --no-plugins should fail while loading the bogus plugin"); } catch (cause) { failures.push(cause); }
      const noPlugins = spawn(TestProject.TTSX_BIN, ["--no-plugins", "src/main.ts"], { cwd: root });
      try { assert.equal(noPlugins.status, 0, noPlugins.stderr); assert.equal(noPlugins.stdout.trim(), "ran"); } catch (cause) { failures.push(cause); }
      if (failures.length) throw new AggregateError(failures, "public no-plugins contrasting routes failed");
    },
  });
  // Original native compiler wrapper is POSIX-only; Windows has no executed profile.
  if (process.platform !== "win32") profiles.push({
    name: "posix-empty-owning-project-attempt-is-memoized-for-two-roots",
    files: {
      "package.json": JSON.stringify({ name: "consumer", private: true }),
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
        `declare const require: (path: string) => Record<string, number>;`,
        `const { a } = require("../tools/a.ts");`,
        `const { b } = require("../tools/b.ts");`,
        `console.log("a=" + a + " b=" + b);`,
        `export {};`,
        ``,
      ].join("\n"),
      "tools/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          experimentalDecorators: true,
          types: [],
        },
        files: [],
      }),
      "tools/a.ts": generatedReferenceProbe("a"),
      "tools/b.ts": generatedReferenceProbe("b"),
    },
    run: (root, _persistent, spawn) => {
    const log = path.join(root, "compiler.jsonl");
    const wrapper = path.join(root, "compiler-wrapper");
    fs.writeFileSync(
      wrapper,
      [
        `#!${process.execPath}`,
        `const fs = require("node:fs");`,
        `const { spawnSync } = require(${JSON.stringify(E2eProcessTrace.runtimePath)});`,
        `const args = process.argv.slice(2);`,
        `fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + "\\n");`,
        `const result = spawnSync(${JSON.stringify(TestProject.TSGO_BINARY)}, args, { stdio: "inherit" });`,
        `process.exit(result.status ?? 1);`,
        ``,
      ].join("\n"),
      { encoding: "utf8", mode: 0o755 },
    );

    const result = spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root, env: { TTSC_TSGO_BINARY: wrapper } },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "a=3 b=3");
    const projectBuilds = fs
      .readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as string[])
      .filter((args) => {
        const tsconfig = args[args.indexOf("-p") + 1];
        // Native terminal inspection calls are still recorded and measured,
        // but do not attempt the failed project emit whose memo is asserted.
        const showConfig = args.lastIndexOf("--showConfig");
        const listFilesOnly = args.lastIndexOf("--listFilesOnly");
        const inspection = (showConfig >= 0 && args[showConfig + 1] !== "false") ||
          (listFilesOnly >= 0 && args[listFilesOnly + 1] !== "false");
        return (
          tsconfig !== undefined &&
          path.basename(tsconfig) === "tsconfig.json" &&
          path.basename(path.dirname(tsconfig)) === "tools" && !inspection
        );
      });
    assert.equal(projectBuilds.length, 1, JSON.stringify(projectBuilds));
    },
  });
  profiles.push({
    name: "forced-launcher-death-preserves-live-program-then-reclaims",
    files: {
      "package.json": JSON.stringify({ name: "killed-run", private: true, workspaces: ["packages/*"] }),
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
      "src/waiting.ts": WAITING_PROGRAM,
      "src/done.ts": `console.log("done");\nexport {};\n`,
    },
    run: async (root, _persistent, spawn, ownAsyncProcess) => {
    const runs = runtimeRunsDirectory(root);
    const runToCompletion = (): void => {
      const result = spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, "src/done.ts"],
        { cwd: root, env: isolatedCacheEnvironment(root) },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "done");
    };

    const acknowledgeJoined = ownAsyncProcess();
    const killed = await startWaitingRun(root, "src/waiting.ts");
    let primaryFailure: unknown;
    try {
      await forceTerminate(killed.launcher.pid!);
      const directory = runDirectory(runs, killed.launcher.pid!);
      assert.equal(fs.existsSync(directory), true, killed.output());

      runToCompletion();
      if (isRunning(killed.program)) {
        assert.equal(
          fs.existsSync(directory),
          true,
          "a later run removed the directory of a program still running",
        );
      }

      await forceTerminate(killed.program);
      runToCompletion();
      assert.deepEqual(
        fs.readdirSync(runs),
        [],
        "the directory of a force-terminated run remained",
      );
    } catch (error) {
      primaryFailure = error;
      throw error;
    } finally {
      try {
        await stopWaitingRun(killed);
        acknowledgeJoined();
      } catch (cleanupError) {
        if (primaryFailure !== undefined) throw new AggregateError(
          [primaryFailure, cleanupError], "terminated run failed and cleanup failed",
        );
        throw cleanupError;
      }
    }
    },
  });
  const manifestlessChildSource = (version: string): string => [
    `declare const process: { pid: number };`,
    `const version: string = "${version}";`,
    `console.log(version + ":" + process.pid);`,
    `export {};`,
    ``,
  ].join("\n");
  profiles.push({
    name: "manifestless-child-refreshes-source-between-public-runs",
    files: {
      "package.json": JSON.stringify({ name: "manifest-less", private: true }),
      "tsconfig.json": JSON.stringify({ compilerOptions: {
        target: "ES2022", module: "commonjs", strict: true, outDir: "lib", types: [],
      }, include: ["src"] }),
      "src/main.ts": [
        `declare const require: (id: string) => any;`,
        `declare const process: { env: Record<string, string | undefined>; execPath: string };`,
        `declare const __dirname: string;`,
        `const { spawnSync } = require(${JSON.stringify(E2eProcessTrace.runtimePath)});`,
        `const path = require("node:path");`,
        `const env = { ...process.env };`,
        `delete env.TTSX_RUNTIME_MANIFEST;`,
        `const result = spawnSync(process.execPath, [path.join(__dirname, "child.ts")], { env, encoding: "utf8" });`,
        `if (result.status !== 0) throw new Error(result.stderr);`,
        `console.log(result.stdout.trim());`,
        `export {};`,
        ``,
      ].join("\n"),
      "src/child.ts": manifestlessChildSource("v1"),
    },
    run: (root, _persistent, spawn) => {
      const pids: string[] = [];
      const failures: unknown[] = [];
      for (const version of ["v1", "v2"]) {
        TestProject.writeFiles(root, { "src/child.ts": manifestlessChildSource(version) });
        const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
        try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
        const [printed, pid] = result.stdout.trim().split(":");
        try {
          assert.equal(printed, version);
          assert.match(pid ?? "", /^[1-9][0-9]*$/);
          assert.ok(Number.isSafeInteger(Number(pid)));
          pids.push(pid!);
        } catch (error) { failures.push(error); }
      }
      const parent = path.join(os.tmpdir(), "ttsx-dep");
      const remaining = fs.existsSync(parent) ? fs.readdirSync(parent) : [];
      for (const pid of pids) {
        try { assert.deepEqual(remaining.filter((name) => name.startsWith(`process-${pid}-`)), [],
          `the child ${pid} left its private cache behind`); } catch (error) { failures.push(error); }
      }
      if (failures.length) throw new AggregateError(failures, "manifest-less child edited-source assertions failed");
    },
  });
  profiles.push({
    name: "native-rootdir-alias-retains-whole-program-ambient-membership",
    files: FixtureFiles.read("ttsc/ttsx_compiles_the_whole_project_when_rootdir_is_a_symlink/inputs-1"),
    run: (root, _persistent, spawn) => {
      try { fs.symlinkSync(path.join(root, "sources"), path.join(root, "src"), "junction"); }
      catch { return false; }
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      const failures: unknown[] = [];
      try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
      try { assert.match(result.stdout, /ran-under-the-project/); } catch (error) { failures.push(error); }
      try { assert.doesNotMatch(result.stderr, /Cannot find name 'BUILD_TAG'/,
        "the entry-only fallback lost the project's ambient declaration"); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, "symlinked rootDir whole-project membership assertions failed");
    },
  });
  profiles.push({
    name: "dependency-root-publication-keeps-linked-and-inferred-physical-spellings",
    files: FixtureFiles.read("ttsc/ttsx_publishes_a_physical_root_for_a_dependency_whose_rootdir_is_a_symlink/inputs-1"),
    run: (root, _persistent, spawn) => {
      try { fs.symlinkSync(path.join(root, "node_modules", "dep", "sources"),
        path.join(root, "node_modules", "dep", "src"), "junction"); }
      catch { return false; }
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
      const failures: unknown[] = [];
      try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
      try { assert.match(result.stdout, /VALUE:dep-value\/dep2-value/); } catch (error) { failures.push(error); }
      try {
        const line = result.stdout.split(/\r?\n/).find(text => text.startsWith("ROOTS:"));
        assert.notEqual(line, undefined, result.stdout);
        const roots = JSON.parse(line!.slice("ROOTS:".length)) as string[];
        assert.equal(roots.length, 2, `the dependency lane did not publish a marker per dependency: ${result.stdout}`);
        for (const published of roots) {
          try { assert.equal(fs.realpathSync.native(published), published,
            "a published dependency rootDir is not its own physical path, so the exact-mirror lookup compares two spellings of one directory"); }
          catch (error) { failures.push(error); }
        }
      } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, "physical dependency root publication assertions failed");
    },
  });
  profiles.push({
    name: "empty-nested-install-boundary-remains-authoritative-after-runtime-cache-write",
    files: FixtureFiles.read("ttsc/ttsx_preserves_an_empty_nested_node_modules_cache_boundary/inputs-1"),
    run: (root, _persistent, spawn) => {
      fs.mkdirSync(path.join(root, "test", "node_modules"));
      const expected = path.join(fs.realpathSync(root), "test", "node_modules", ".cache", "ttsc");
      const failures: unknown[] = [];
      // Clearing the override is part of the original child input: the actual
      // nearer empty installation, not the cohort cache, must choose this root.
      const env = { TTSC_CACHE_DIR: "" };
      for (const phase of ["before", "after"]) {
        if (phase === "after") {
          const result = spawn(TestProject.TTSX_BIN,
            ["--cwd", root, "--project", "test/tsconfig.json", "test/main.ts"], { cwd: root, env });
          try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
          try { assert.equal(result.stdout.trim(), "empty-install-boundary"); } catch (error) { failures.push(error); }
        }
        const query = spawn(TestProject.TTSC_BIN,
          ["cache", "paths", "--json", "--cwd", root, "--project", "test/tsconfig.json"], { cwd: root, env });
        try { assert.equal(query.status, 0, query.stderr); } catch (error) { failures.push(error); }
        try { assert.equal((JSON.parse(query.stdout) as { cacheRoot: string }).cacheRoot, expected, phase); }
        catch (error) { failures.push(error); }
      }
      try { assert.deepEqual(fs.readdirSync(path.join(expected, "ttsx", "project")), []); }
      catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, "empty nested cache boundary assertions failed");
    },
  });
  // Source depth is an input distinction: stage the original layouts in
  // separate compiler profiles rather than changing either inferred root.
  for (const layout of [
    { name: "nested", entry: "src/main.ts", leaked: ["src/main.js", "src/lib/greeting.js"] },
    { name: "flat", entry: "main.ts", leaked: ["main.js", "helper.js"] },
  ]) {
    profiles.push({
      name: `check-only-${layout.name}-entry-infers-root-without-source-adjacent-emit`,
      files: {
        "tsconfig.json": TestProject.tsconfig(
          { target: "ES2022", module: "commonjs", strict: true, noEmit: true },
          layout.name === "flat" ? { include: ["*.ts"] } : {},
        ),
        ...FixtureFiles.read(`ttsc/ttsx_runs_a_${layout.name}_entry_whose_project_declares_no_rootdir/inputs-1`),
      },
      run: (root, _persistent, spawn) => {
        const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, layout.entry], { cwd: root });
        const failures: unknown[] = [];
        try { assert.equal(result.status, 0, `${result.stdout}${result.stderr}`); } catch (error) { failures.push(error); }
        try { assert.equal(result.stdout.trim(), `no-rootdir-${layout.name}`); } catch (error) { failures.push(error); }
        for (const relative of layout.leaked) {
          const leaked = path.join(root, relative);
          try { assert.equal(fs.existsSync(leaked), false,
            `the runtime emit escaped into the source tree at ${leaked}`); } catch (error) { failures.push(error); }
        }
        if (failures.length) throw new AggregateError(failures, `${layout.name} check-only inferred root assertions failed`);
      },
    });
  }
  profiles.push({
    name: "ancestor-cwd-discovers-nested-package-with-root-config-absent",
    files: FixtureFiles.read("ttsc/runner_corpus_nested_entry_discovers_nearest_package_tsconfig/inputs-1"),
    run: (root, _persistent, spawn) => {
      assert.equal(fs.existsSync(path.join(root, "tsconfig.json")), false);
      const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "packages/app/src/main.ts"], { cwd: root });
      const failures: unknown[] = [];
      try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
      try { assert.equal(result.stdout.trim(), "nested-tsconfig-ok"); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, "nested entry discovers package tsconfig assertions failed");
    },
  });
  profiles.push({
    name: "failed-preparation-pins-linked-run-index-before-descriptor-retarget",
    files: {
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": TestProject.tsconfig({ module: "commonjs", outDir: "dist",
        plugins: [{ transform: "./plugin.cjs" }], rootDir: "src", strict: true, target: "ES2022" }),
      "src/main.ts": 'console.log("unreached");\n',
      "plugin.cjs": [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        "const generations = fs.readdirSync(process.env.TTSC_TEST_ORIGINAL_RUNS);",
        'if (generations.length !== 1) throw new Error("expected one runtime generation");',
        "fs.rmSync(process.env.TTSC_TEST_RUN_INDEX_ALIAS, { force: true, recursive: true });",
        'fs.symlinkSync(process.env.TTSC_TEST_VICTIM_RUNS, process.env.TTSC_TEST_RUN_INDEX_ALIAS, process.platform === "win32" ? "junction" : "dir");',
        "const victim = path.join(process.env.TTSC_TEST_VICTIM_RUNS, generations[0]);",
        "fs.mkdirSync(victim, { recursive: true });",
        'fs.writeFileSync(path.join(victim, "keep.txt"), "victim", "utf8");',
        'module.exports = { name: "retarget", source: path.join(process.env.TTSC_TEST_PROJECT, "missing-plugin") };',
        "",
      ].join("\n"),
    },
    run: (root, _persistent, spawn, _ownAsyncProcess, abortReuse) => {
      const cache = path.join(linkedInputs, "run-index-alias-cache");
      const originalRuns = path.join(linkedInputs, "run-index-original-runs");
      const victimRuns = path.join(linkedInputs, "run-index-victim-runs");
      const alias = path.join(cache, "project");
      for (const directory of [cache, originalRuns, victimRuns]) fs.mkdirSync(directory);
      fs.symlinkSync(originalRuns, alias, process.platform === "win32" ? "junction" : "dir");
      const failures: unknown[] = [];
      let completed = false;
      try {
        const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "--cache-dir", cache, "src/main.ts"], {
          cwd: root, env: { TTSC_TEST_ORIGINAL_RUNS: originalRuns, TTSC_TEST_PROJECT: root,
            TTSC_TEST_RUN_INDEX_ALIAS: alias, TTSC_TEST_VICTIM_RUNS: victimRuns },
        });
        completed = true;
        try { assert.notEqual(result.status, 0); } catch (error) { failures.push(error); }
        try { assert.match(result.stderr, /plugin "retarget" source does not exist/); } catch (error) { failures.push(error); }
        try {
          const [generation, ...extra] = fs.readdirSync(victimRuns);
          assert.ok(generation);
          assert.deepEqual(extra, []);
          assert.equal(fs.readFileSync(path.join(victimRuns, generation, "keep.txt"), "utf8"), "victim");
        } catch (error) { failures.push(error); }
        try { assert.deepEqual(fs.readdirSync(originalRuns), []); } catch (error) { failures.push(error); }
      } catch (error) { failures.push(error); }
      finally {
        if (!completed) {
          TestProject.retainTemporaryDirectory(linkedInputs, "Unresolved run-index retarget host retains both native targets");
          abortReuse(new AggregateError(failures, "unresolved linked run-index host"));
        }
        try { fs.unlinkSync(alias); }
        catch (unlinkError) {
          try { fs.rmdirSync(alias); }
          catch (removeError) {
            TestProject.retainTemporaryDirectory(linkedInputs, "Failed run-index alias removal retains both native targets");
            abortReuse(new AggregateError([...failures, unlinkError, removeError], "failed run-index alias cleanup"));
          }
        }
      }
      if (failures.length) throw new AggregateError(failures, "linked run-index failure cleanup assertions failed");
    },
  });
  profiles.push({
    name: "failed-preparation-cleans-physical-generation-after-cache-alias-retarget",
    files: {
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": TestProject.tsconfig({ module: "commonjs", outDir: "dist", plugins: [{ transform: "./plugin.cjs" }], rootDir: "src", strict: true, target: "ES2022" }),
      "src/main.ts": 'console.log("unreached");\n',
      "plugin.cjs": [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        'const generations = fs.readdirSync(path.join(process.env.TTSC_TEST_PHYSICAL_CACHE, "project"));',
        'if (generations.length !== 1) throw new Error("expected one runtime generation");',
        "fs.rmSync(process.env.TTSC_TEST_CACHE_ALIAS, { force: true, recursive: true });",
        'fs.symlinkSync(process.env.TTSC_TEST_VICTIM_CACHE, process.env.TTSC_TEST_CACHE_ALIAS, process.platform === "win32" ? "junction" : "dir");',
        'const victim = path.join(process.env.TTSC_TEST_VICTIM_CACHE, "project", generations[0]);',
        "fs.mkdirSync(victim, { recursive: true });",
        'fs.writeFileSync(path.join(victim, "keep.txt"), "victim", "utf8");',
        'module.exports = { name: "retarget", source: path.join(process.env.TTSC_TEST_PROJECT, "missing-plugin") };',
        "",
      ].join("\n"),
    },
    run: (root, _persistent, spawn, _ownAsyncProcess, abortReuse) => {
      const physicalCache = path.join(linkedInputs, "failed-preparation-physical-cache");
      const victimCache = path.join(linkedInputs, "failed-preparation-victim-cache");
      const cacheAlias = path.join(linkedInputs, "failed-preparation-cache-alias");
      // Native fresh creation preserves the cold generation oracle; no shared
      // cache deletion or lexical guessed generation substitutes for it.
      fs.mkdirSync(physicalCache);
      fs.mkdirSync(victimCache);
      fs.symlinkSync(physicalCache, cacheAlias, process.platform === "win32" ? "junction" : "dir");
      const failures: unknown[] = [];
      let completed = false;
      try {
        const result = spawn(TestProject.TTSX_BIN, ["--cwd", root, "--cache-dir", cacheAlias, "src/main.ts"], {
          cwd: root,
          env: { TTSC_TEST_CACHE_ALIAS: cacheAlias, TTSC_TEST_PHYSICAL_CACHE: physicalCache,
            TTSC_TEST_PROJECT: root, TTSC_TEST_VICTIM_CACHE: victimCache },
        });
        completed = true;
        try { assert.notEqual(result.status, 0); } catch (error) { failures.push(error); }
        try { assert.match(result.stderr, /plugin "retarget" source does not exist/); } catch (error) { failures.push(error); }
        try {
          const [generation, ...extraGenerations] = fs.readdirSync(path.join(victimCache, "project"));
          assert.ok(generation);
          assert.deepEqual(extraGenerations, []);
          assert.equal(fs.readFileSync(path.join(victimCache, "project", generation, "keep.txt"), "utf8"), "victim");
        } catch (error) { failures.push(error); }
        try { assert.deepEqual(fs.readdirSync(path.join(physicalCache, "project")), []); } catch (error) { failures.push(error); }
      } catch (error) { failures.push(error); }
      finally {
        if (!completed) {
          TestProject.retainTemporaryDirectory(linkedInputs, "Unresolved failed-preparation host retains physical and victim cache aliases");
          abortReuse(new AggregateError(failures, "unresolved runtime cache alias host"));
        }
        try { fs.unlinkSync(cacheAlias); }
        catch (unlinkError) {
          try { fs.rmdirSync(cacheAlias); }
          catch (removeError) {
            TestProject.retainTemporaryDirectory(linkedInputs, "Failed cache alias restoration retains physical and victim inputs");
            abortReuse(new AggregateError([...failures, unlinkError, removeError], "failed runtime cache alias cleanup"));
          }
        }
      }
      if (failures.length) throw new AggregateError(failures, "failure_cleanup_retains_physical_cache_generation assertions failed");
    },
  });
  const mochaConfig = JSON.stringify({ compilerOptions: {
    module: "commonjs", outDir: "dist", rootDir: "src", strict: true, target: "ES2022",
  }, include: ["src"] });
  const mochaSource = (suite: string, expected: string, assertCoexistence = false): string => {
    const coexistence = !assertCoexistence ? "" : [
      `    const fs = require("node:fs");`,
      `    const path = require("node:path");`,
      `    const cache = path.join(process.cwd(), "node_modules", ".cache", "ttsc", "ttsx", "project");`,
      `    if (fs.readdirSync(cache).length !== 3) throw new Error("expected three roots in the shared workspace cache");`,
    ].join("\n");
    return [
      `declare function describe(name: string, body: () => void): void;`,
      `declare function it(name: string, body: () => void): void;`,
      `declare function require(name: string): any;`,
      `declare const process: { cwd(): string };`,
      `enum Expected { Value = ${JSON.stringify(expected)} }`,
      `describe(${JSON.stringify(suite)}, () => {`,
      `  it("uses the checked emit", () => {`,
      `    if (Expected.Value !== ${JSON.stringify(expected)}) throw new Error("wrong value");`,
      coexistence,
      `  });`,
      `});`,
      "",
    ].join("\n");
  };
  profiles.push({
    name: "public-register-mocha-keeps-three-excluded-roots-live-until-exit",
    files: {
      "package.json": JSON.stringify({ name: "ttsx-register-mocha", type: "commonjs", version: "1.0.0" }),
      "one/tsconfig.json": mochaConfig,
      "one/src/value.ts": `export enum Value { One = "one" }\n`,
      "one/test/first/index.ts": mochaSource("first", "one"),
      "one/test/second/index.ts": mochaSource("second", "one"),
      "two/tsconfig.json": mochaConfig,
      "two/src/value.ts": `export enum Value { Two = "two" }\n`,
      "two/test/third/index.ts": mochaSource("third", "two", true),
    },
    run: (root, _persistent, spawn) => {
      linkTtscPackage(root);
      const result = spawn(process.execPath, [MOCHA_BIN, "--require", TTSX_REGISTER, "--extension", "ts",
        "one/test/first/index.ts", "one/test/second/index.ts", "two/test/third/index.ts"],
        { cwd: root, env: { TTSC_CACHE_DIR: "" } });
      const failures: unknown[] = [];
      try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
      try { assert.match(result.stdout, /3 passing/); } catch (error) { failures.push(error); }
      for (const suite of ["first", "second", "third"]) {
        try { assert.match(result.stdout, new RegExp(`\\b${suite}\\b`)); } catch (error) { failures.push(error); }
      }
      const runtime = path.join(root, "node_modules", ".cache", "ttsc", "ttsx", "project");
      try { assert.deepEqual(fs.existsSync(runtime) ? fs.readdirSync(runtime) : [], []); } catch (error) { failures.push(error); }
      for (const project of ["one", "two"]) {
        try { assert.equal(fs.existsSync(path.join(root, project, "node_modules")), false); } catch (error) { failures.push(error); }
      }
      if (failures.length) throw new AggregateError(failures, "register multiple out-of-include Mocha roots assertions failed");
    },
  });
  for (const entry of [
    { module: "commonjs", name: "commonjs", packageType: "commonjs" },
    { module: "nodenext", name: "esm", packageType: "module" },
  ]) profiles.push({
    name: `public-register-checked-${entry.name}-main-and-native-builtins`,
    files: {
      "package.json": JSON.stringify({ name: `ttsx-register-${entry.name}`, type: entry.packageType, version: "1.0.0" }),
      "tsconfig.json": JSON.stringify({ compilerOptions: {
        module: entry.module, outDir: "dist", rootDir: "src", strict: true, target: "ES2022",
      }, include: ["src"] }),
      "src/node-sqlite.d.ts": entry.name === "esm" ? `declare module "node:sqlite" { export class DatabaseSync { constructor(location: string); close(): void; } }` : "",
      "src/main.ts": [
        `enum RuntimeKind { Value = ${JSON.stringify(entry.name)} }`,
        `const value: string = RuntimeKind.Value;`,
        ...(entry.name === "commonjs" ? [
          `declare function require(specifier: string): any;`,
          `const prefix = ["node:sqlite", "node:test", "node:test/reporters", "node:sea"].map((specifier) => require(specifier));`,
          `console.log(JSON.stringify({ kind: value, prefix: prefix.every((item) => item !== null && item !== undefined), cryptoLength: require("node:crypto").randomUUID().length }));`,
        ] : [
          `import { DatabaseSync } from "node:sqlite";`,
          `const database = new DatabaseSync(":memory:"); database.close();`,
          `console.log(JSON.stringify({ kind: value, sqlite: "esm-sqlite-ok" }));`,
        ]),
        "",
      ].join("\n"),
    },
    run: (root, _persistent, spawn) => {
      linkTtscPackage(root);
      const result = spawn(process.execPath, ["--require", TTSX_REGISTER, "src/main.ts"], { cwd: root });
      const failures: unknown[] = [];
      try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
      try { assert.deepEqual(JSON.parse(result.stdout.trim()), entry.name === "commonjs"
        ? { kind: "commonjs", prefix: true, cryptoLength: 36 }
        : { kind: "esm", sqlite: "esm-sqlite-ok" }); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, `register checked ${entry.name} main assertions failed`);
    },
  });
  profiles.push({
    name: "javascript-main-keeps-option-shaped-user-argv-and-typed-dependency",
    files: {
      "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", strict: true, outDir: "dist", rootDir: "src" }),
      ...FixtureFiles.read("ttsc/ttsx_runs_a_javascript_entry_with_its_own_argv/inputs-1"),
    },
    run: (root, _persistent, spawn) => {
      const result = spawn(TestProject.TTSX_BIN,
        ["script.js", "--config", "x", "--port", "3", "--help"], { cwd: root });
      const failures: unknown[] = [];
      try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
      try { assert.deepEqual(JSON.parse(result.stdout.trim()), {
        argv: ["--config", "x", "--port", "3", "--help"], main: true, value: "typed",
      }); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, "ttsx_runs_a_javascript_entry_with_its_own_argv assertions failed");
    },
  });
  profiles.push({
    name: "owner-preload-claims-before-user-and-refuses-missing-run",
    files: {},
    run: (root, _persistent, spawn) => {
      const run = path.join(root, "ttsx", "project", "claim");
      fs.mkdirSync(run, { recursive: true });
      const preload = path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib", "launcher", "internal", "runtimeOwnerPreload.js");
      const marker = path.join(root, "executed");
      const manifest = path.join(run, "runtime-manifest.json");
      fs.writeFileSync(manifest, "{}", "utf8");
      const program = [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        "const run = process.env.TTSX_RUNTIME_RUN_DIR;",
        "const owner = path.join(run, `owner-${process.pid}.json`);",
        'if (!fs.existsSync(owner)) throw new Error("owner was not published");',
        `fs.writeFileSync(${JSON.stringify(marker)}, "executed");`,
      ].join("\n");
      const start = (source = program, inheritedManifest = manifest) =>
        spawn(process.execPath, ["-r", preload, "-e", source], {
          cwd: root,
          env: {
            NODE_OPTIONS: "",
            TTSX_RUNTIME_MANIFEST: inheritedManifest,
            TTSX_RUNTIME_CACHE_DIR: path.dirname(path.dirname(run)),
            TTSX_RUNTIME_RUN_DIR: run,
            TTSX_RUNTIME_RUNS_DIR: path.dirname(run),
          },
        });
      const failures: unknown[] = [];
      const claimed = start();
      try { assert.equal(claimed.status, 0, claimed.stderr); } catch (error) { failures.push(error); }
      try { assert.equal(fs.readFileSync(marker, "utf8"), "executed"); } catch (error) { failures.push(error); }
      fs.rmSync(run, { recursive: true, force: true });
      // Remove the first observation even if the positive assertion failed.
      fs.rmSync(marker, { force: true });
      const missing = start();
      try { assert.notEqual(missing.status, 0, missing.stdout); } catch (error) { failures.push(error); }
      try { assert.equal(fs.existsSync(marker), false, missing.stderr); } catch (error) { failures.push(error); }
      const independent = start(
        `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "independent");`,
        "",
      );
      try { assert.equal(independent.status, 0, independent.stderr); } catch (error) { failures.push(error); }
      try { assert.equal(fs.readFileSync(marker, "utf8"), "independent"); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, "runtime_owner_preload_claims_before_program_and_rejects_a_missing_run assertions failed");
    },
  });
  profiles.push({
    name: "public-clean-refuses-actually-unreadable-runtime-index",
    files: FixtureFiles.read("ttsc/ttsc_clean_refuses_an_unreadable_runtime_index/inputs-1"),
    run: (root, _persistent, spawn, _ownAsyncProcess, abortReuse) => {
      if (process.platform === "win32") return false;
      const runs = runtimeRunsDirectory(root);
      const runtime = path.dirname(runs);
      fs.mkdirSync(path.join(runs, "held"), { recursive: true });
      const originalMode = fs.statSync(runs).mode & 0o777;
      let primaryFailure: unknown;
      try {
        fs.chmodSync(runs, 0o000);
        try {
          fs.readdirSync(runs);
          return false;
        } catch (cause) {
          assert.ok(["EACCES", "EPERM"].includes((cause as NodeJS.ErrnoException).code ?? ""));
        }
        const result = spawn(TestProject.TTSC_BIN, ["clean", "--cwd", root],
          { cwd: root, env: isolatedCacheEnvironment(root) });
        assert.notEqual(result.status, 0, result.stdout);
        assert.equal(fs.existsSync(runtime), true);
      } catch (cause) {
        primaryFailure = cause;
        throw cause;
      } finally {
        try { fs.chmodSync(runs, originalMode); }
        catch (restorationFailure) {
          abortReuse(new AggregateError([
            ...(primaryFailure === undefined ? [] : [primaryFailure]), restorationFailure,
          ], "unreadable runtime index permission restoration failed"));
        }
      }
    },
  });
  profiles.push({
    name: "public-clean-keeps-live-run-and-api-removes-all-dead-runtime",
    files: {
      "package.json": JSON.stringify({ name: "clean-runs", private: true, workspaces: ["packages/*"] }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: { target: "ES2022", module: "commonjs", strict: true, outDir: "lib", types: [] },
        include: ["src"],
      }),
      "src/waiting.ts": WAITING_PROGRAM,
    },
    run: async (root, _persistent, spawn, ownAsyncProcess) => {
      const acknowledgeRunningJoined = ownAsyncProcess();
      const runs = runtimeRunsDirectory(root);
      const env = isolatedCacheEnvironment(root);
      const running = await startWaitingRun(root, "src/waiting.ts");
      const acknowledgeKilledJoined = ownAsyncProcess();
      let killed: IWaitingRun | undefined;
      let primaryFailure: unknown;
      try {
        killed = await startWaitingRun(root, "src/waiting.ts");
        await forceTerminate(killed.launcher.pid!);
        await forceTerminate(killed.program);
        const kept = runDirectory(runs, running.launcher.pid!);
        const terminated = runDirectory(runs, killed.launcher.pid!);
        assert.equal(fs.existsSync(terminated), true, killed.output());
        const result = spawn(TestProject.TTSC_BIN, ["clean", "--cwd", root], { cwd: root, env });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(fs.existsSync(terminated), false, result.stdout);
        assert.equal(fs.existsSync(kept), true, result.stdout);
        assert.ok(result.stdout.split(/\r?\n/).includes(
          `ttsc: kept ${path.relative(root, kept)}: a run that may still be in progress owns it`,
        ), result.stdout);
        await forceTerminate(running.launcher.pid!);
        await forceTerminate(running.program);
        const runtime = path.dirname(runs);
        const spellings = new Set([runtime, fs.realpathSync(runtime), fs.realpathSync.native(runtime)]);
        assert.ok(new TtscCompiler({ cwd: root, env }).clean().some((removed) => spellings.has(removed)),
          "TtscCompiler.clean() did not report the runtime directory");
        assert.equal(fs.existsSync(runtime), false);
      } catch (cause) {
        primaryFailure = cause;
        throw cause;
      } finally {
        const outcomes = await Promise.allSettled([
          stopWaitingRun(running),
          ...(killed === undefined ? [] : [stopWaitingRun(killed)]),
        ]);
        const cleanupFailures = outcomes.filter((outcome) => outcome.status === "rejected");
        if (cleanupFailures.length !== 0) throw new AggregateError([
          ...(primaryFailure === undefined ? [] : [primaryFailure]),
          ...cleanupFailures.map((failure) => failure.reason),
        ], "waiting pair cleanup failed");
        acknowledgeRunningJoined();
        if (killed !== undefined) acknowledgeKilledJoined();
      }
    },
  });
  profiles.push({
    name: "same-pid-remote-owner-tree-survives-native-preparation",
    files: FixtureFiles.read("ttsc/ttsx_keeps_a_run_directory_another_run_named_by_the_same_pid/inputs-1"),
    run: async (root, _persistent, _spawn, ownAsyncProcess) => {
    const cache = path.join(linkedInputs, "same-pid-cache");
    fs.mkdirSync(cache);
    assert.deepEqual(fs.readdirSync(cache), []);
    const worker = path.join(root, "prepare-worker.cjs");
    fs.writeFileSync(
      worker,
      [
        'const fs = require("node:fs");',
        'const os = require("node:os");',
        'const path = require("node:path");',
        `const { prepareExecution } = require(${JSON.stringify(
          path.join(
            TestProject.WORKSPACE_ROOT,
            "packages",
            "ttsc",
            "lib",
            "launcher",
            "internal",
            "prepareExecution.js",
          ),
        )});`,
        `const cache = ${JSON.stringify(cache)};`,
        'const other = path.join(cache, "project", String(process.pid));',
        "fs.mkdirSync(other, { recursive: true });",
        "fs.writeFileSync(",
        '  path.join(other, "owner-" + process.pid + ".json"),',
        '  JSON.stringify({ hostname: os.hostname() + "-elsewhere", pid: process.pid }),',
        ");",
        'fs.writeFileSync(path.join(other, "in-use.txt"), "in use");',
        `const execution = prepareExecution(${JSON.stringify(
          path.join(root, "src", "main.ts"),
        )}, { cacheDir: cache });`,
        "process.stdout.write(JSON.stringify({",
        "  other,",
        '  otherKept: fs.existsSync(path.join(other, "in-use.txt")),',
        "  runDirectory: execution.cleanupDir,",
        "}));",
        "",
      ].join("\n"),
      "utf8",
    );

    const acknowledgeJoined = ownAsyncProcess();
    const result = await spawnNodeWorker({
      env: {
        TTSC_BINARY: TestProject.NATIVE_BINARY,
        TTSC_TSGO_BINARY: TestProject.TSGO_BINARY,
      },
      script: worker,
    });
    acknowledgeJoined();
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout) as {
      other: string;
      otherKept: boolean;
      runDirectory: string;
    };
    assert.equal(
      report.otherKept,
      true,
      "a run erased the directory of another run with its process id",
    );
    assert.notEqual(
      path.resolve(report.runDirectory),
      path.resolve(report.other),
      "a run claimed the directory of another run with its process id",
    );
    },
  });
  profiles.push({
    name: "cli-and-import-register-sweep-distinct-actual-dead-owner-trees",
    files: FixtureFiles.read("ttsc/ttsx_and_register_remove_a_run_directory_whose_owners_are_gone/inputs-1"),
    run: (root, _persistent, spawn) => {
      const runs = runtimeRunsDirectory(root);
      const env = isolatedCacheEnvironment(root);
      const endedProcessId = (): number => {
        for (let attempt = 0; attempt < 8; attempt++) {
          const result = spawn(process.execPath, ["-e", ""], { cwd: root, env });
          assert.equal(result.status, 0, result.stderr);
          assert.equal(result.signal, null);
          assert.ok(Number.isSafeInteger(result.pid) && result.pid > 0, "actual exited Node PID required");
          try { process.kill(result.pid, 0); }
          catch (cause) {
            if ((cause as NodeJS.ErrnoException).code === "ESRCH") return result.pid;
            throw new Error("departed owner absence could not be observed", { cause });
          }
        }
        throw new Error("BLOCKED: no ESRCH-only departed owner after eight actual Node exits");
      };
      const plant = (name: string): string => {
        const directory = path.join(runs, name);
        const pid = endedProcessId();
        fs.mkdirSync(path.join(directory, "fs"), { recursive: true });
        fs.writeFileSync(path.join(directory, `owner-${pid}.json`), JSON.stringify({ hostname: os.hostname(), pid }), "utf8");
        fs.writeFileSync(path.join(directory, "fs", "main.js"), "", "utf8");
        return directory;
      };
      const failures: unknown[] = [];
      const byTtsx = plant("ended-ttsx-run");
      const ttsx = spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root, env });
      try {
        assert.equal(ttsx.status, 0, ttsx.stderr);
        assert.equal(ttsx.stdout.trim(), "ran");
        assert.equal(fs.existsSync(byTtsx), false, "ttsx kept a run directory whose owners are gone");
      } catch (cause) { failures.push(cause); }
      const byRegister = plant("ended-register-run");
      const registered = spawn(process.execPath, ["--import", pathToFileURL(path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "lib", "register.js")).href, "src/main.ts"], { cwd: root, env });
      try {
        assert.equal(registered.status, 0, registered.stderr);
        assert.equal(registered.stdout.trim(), "ran");
        assert.equal(fs.existsSync(byRegister), false, "ttsc/register kept a run directory whose owners are gone");
      } catch (cause) { failures.push(cause); }
      if (failures.length) throw new AggregateError(failures, "both public dead-owner sweep adapters failed");
    },
  });
  return profiles;
}

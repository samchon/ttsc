import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  JSX_COMPONENT_OUTPUT,
  JSX_COMPONENT_SOURCE,
  JSX_RUNTIME_PACKAGE,
} from "../../internal/ttsx-jsx";

/**
 * Verifies ttsx runs JSX a project preserves while declaring a classic factory,
 * compiled through that factory.
 *
 * The runtime build replaces a preserved JSX mode with an executable one, and
 * which one follows the project's declaration (samchon/ttsc#1408): a project
 * that names `jsxFactory` and `jsxFragmentFactory` writes its code against the
 * classic transform, whose calls go through those names in scope. Choosing the
 * automatic runtime instead would import a `jsx-runtime` the project never
 * asked for.
 *
 * 1. Create a `preserve` project with `jsxFactory: "h"` and `jsxFragmentFactory:
 *    "Fragment"`, whose component imports both from the local runtime and
 *    declares the global `JSX` namespace.
 * 2. Run the entry.
 * 3. Assert the component renders.
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx renders the original classic preserved entry and five executable/declaration profiles, requiring exact authored HTML in every labeled output.
 * @evidence contracts/testing.md#independent-expectations The authored myjsx runtime renders the literal div/hello and fragment/b/world sequence; each exact string is independent of compiler mode selection.
 * @evidence contracts/testing.md#distinguishing-cases The classic preserved root remains an entry; react, react-jsxdev, preserved namespace and factory/namespace beside import-source execute as separate immutable owning dependency programs. runtimeCompilerArgs units own each option decision; the complementary response-file entry retains native root option transport.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns one actual Node host and six labeled HTML assertions; fixture components are inputs. Caught requires and final AggregateError expose all still-executable profile results.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler lowering must import the automatic/development runtime or invoke the classic in-scope declarations and produce executable JSX. Option-array decisions do not prove these rendering effects.
 * @evidence contracts/e2e.md#shared-execution The original classic entry and five formerly independent option roots share one root workspace, one JSX runtime fixture and one host. Genuinely different dependency compiler configurations retain separate programs inside that session; response-file root transport has its own minimal consumer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each immutable profile has a unique package/config identity so module and compiler caches cannot alias different declarations. No source mutation or invalidation transition is removed; synchronous host completion precedes tracked fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The original classic success/HTML and all five original executable-mode/declaration success/HTML distinctions remain. The sixth response-file mode stays in its named native entry; root-policy permutations have explicit source-unit owners and no parser-only claim replaces these compiler effects.
 */
export function test_ttsx_runs_preserved_jsx_through_a_classic_factory() {
  const root = TestProject.createProject({
    ...JSX_RUNTIME_PACKAGE,
    "package.json": JSON.stringify({ name: "classic-jsx", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        jsx: "preserve",
        jsxFactory: "h",
        jsxFragmentFactory: "Fragment",
        outDir: "lib",
        types: [],
      },
      include: ["src"],
    }),
    "src/jsx.d.ts": [
      `declare namespace JSX {`,
      `  type Element = string;`,
      `  interface IntrinsicElements { [name: string]: { children?: unknown } }`,
      `}`,
      ``,
    ].join("\n"),
    "src/view.tsx": [
      `import { Fragment, h } from "myjsx";`,
      `void h;`,
      `void Fragment;`,
      JSX_COMPONENT_SOURCE,
    ].join("\n"),
    "src/main.tsx": [
      `import { view } from "./view";`,
      `console.log(view);`,
      ``,
    ].join("\n"),
  });

  const globalJsx = 'declare namespace JSX { type Element = string; interface IntrinsicElements { [name: string]: { children?: unknown } } }\n';
  const classic = 'import { Fragment, h } from "myjsx";\nvoid h; void Fragment;\n';
  const profiles = [
    { name: "react", options: { jsx: "react", jsxFactory: "h", jsxFragmentFactory: "Fragment" }, view: classic + JSX_COMPONENT_SOURCE, global: true },
    { name: "development", options: { jsx: "react-jsxdev", jsxImportSource: "myjsx" }, view: JSX_COMPONENT_SOURCE },
    { name: "namespace", options: { jsx: "preserve", reactNamespace: "R" }, view: 'import * as R from "myjsx";\nvoid R;\n' + JSX_COMPONENT_SOURCE, global: true },
    { name: "factory-import", options: { jsx: "preserve", jsxFactory: "h", jsxFragmentFactory: "Fragment", jsxImportSource: "myjsx" }, view: JSX_COMPONENT_SOURCE },
    { name: "namespace-import", options: { jsx: "preserve", reactNamespace: "R", jsxImportSource: "myjsx" }, view: JSX_COMPONENT_SOURCE },
  ];
  const additions: Record<string, string> = {};
  const entry = ['declare const require: (name: string) => { view: string };', 'declare const process: { exitCode: number };', 'console.log("BEGIN:classic");', 'try { console.log(require("./view").view); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }', 'console.log("END:classic");'];
  for (const profile of profiles) {
    const name = "jsx-" + profile.name;
    const directory = "node_modules/" + name;
    additions[directory + "/package.json"] = JSON.stringify({ name, type: "commonjs", exports: "./src/view.tsx" });
    additions[directory + "/tsconfig.json"] = TestProject.tsconfig({ target: "ES2022", module: "commonjs", strict: true, outDir: "lib", types: [], ...profile.options });
    additions[directory + "/src/view.tsx"] = profile.view;
    if (profile.global) additions[directory + "/src/jsx.d.ts"] = globalJsx;
    entry.push(`console.log("BEGIN:${profile.name}");`, `try { console.log(require(${JSON.stringify(name)}).view); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }`, `console.log("END:${profile.name}");`);
  }
  additions["src/main.tsx"] = entry.join("\n");
  TestProject.writeFiles(root, additions);
  const result = TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.tsx"], { cwd: root });
  const lines = result.stdout.trim().split(/\r?\n/);
  const failures: unknown[] = [];
  try {
    const begin = lines.indexOf("BEGIN:classic");
    const end = lines.indexOf("END:classic");
    assert.ok(begin >= 0 && end > begin, "classic entry");
    assert.equal(lines.slice(begin + 1, end).join("\n"), JSX_COMPONENT_OUTPUT, "classic entry");
  } catch (error) { failures.push(error); }
  for (const profile of profiles) {
    try {
      const begin = lines.indexOf("BEGIN:" + profile.name);
      const end = lines.indexOf("END:" + profile.name);
      assert.ok(begin >= 0 && end > begin, profile.name);
      assert.equal(lines.slice(begin + 1, end).join("\n"), JSX_COMPONENT_OUTPUT, profile.name);
    } catch (error) { failures.push(error); }
  }
  try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, "JSX rendering profiles failed");
}

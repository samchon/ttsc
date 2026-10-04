import { FileSystemIterator, TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

import factory, { TsPrinter } from "../../../../packages/factory/src/index";
import { prepareEvidenceDependencies } from "../../../utils/src/evidence/prepareEvidenceDependencies";

/** Owns the one corpus all nine real boundary sessions consume. */
export namespace BatchWorkspace {
  export interface Workspace {
    root: string;
    cache: string;
    installedTtsx: string;
    programRunLog: string;
    installationOnly: boolean;
    expected: readonly { title: string; units: number[] }[];
  }
  let preparation: Promise<Workspace> | undefined;

  /** Borrow the immutable prepared input graph; preparation happens once. */
  export function open(): Promise<Workspace> {
    return preparation ??= prepare();
  }

  /** Compare every delivered value with its pre-print UTF-16 input oracle. */
  export function assertResult(value: unknown, expected: Workspace["expected"], nativePipeline = "A:PLUGIN:z"): void {
    assert.ok(value !== null && typeof value === "object");
    const result = value as { authoredMarker: unknown; answer: unknown; data: unknown; neighbor: unknown; values: unknown; nativePipeline: unknown; nativeNeighbor: unknown };
    const failures: Error[] = [];
    const check = (name: string, run: () => void): void => {
      try { run(); } catch (cause) { failures.push(new Error(name, { cause })); }
    };
    check("authored source marker", () => assert.equal(result.authoredMarker, "authored-marker"));
    check("retained contract value", () => assert.equal(result.answer, 42));
    check("resolved JSON alias", () => assert.equal(result.data, 42));
    check("unchanged JSON neighbor", () => assert.equal(result.neighbor, "retained"));
    check("actual native config transport and string transform", () => assert.equal(result.nativePipeline, nativePipeline));
    check("unchanged native neighbor", () => assert.equal(result.nativeNeighbor, "native-neighbor-retained"));
    assertValues(result.values, expected);
    if (failures.length) throw new AggregateError(failures, "Shared boundary assertions failed");
  }

  /** Compare observed native values without inventing unrelated utility results. */
  export function assertValues(input: unknown, expected: Workspace["expected"]): void {
    const failures: Error[] = [];
    const check = (name: string, run: () => void): void => {
      try { run(); } catch (cause) { failures.push(new Error(name, { cause })); }
    };
    assert.ok(Array.isArray(input));
    const values = input;
    check("complete JSX population", () => assert.equal(values.length, expected.length));
    expected.forEach((row, index) => check(row.title, () => {
      const actual = values[index];
      assert.equal(typeof actual, "string");
      assert.deepEqual((actual as string).split("").map((unit) => unit.charCodeAt(0)), row.units);
    }));
    if (failures.length) throw new AggregateError(failures, "Shared boundary assertions failed");
  }

  /** Interpret actual bundle bytes as an independent JavaScript value oracle. */
  export function readBundle(code: string): unknown {
    const context = vm.createContext({ console: { info() {}, debug() {}, warn() {} } });
    vm.runInContext(code, context, { timeout: 30_000 });
    return JSON.parse(JSON.stringify(context.TTSC_BATCH_RESULT));
  }

  /** Decode the single labeled payload without borrowing test-runner output. */
  export function readPayload(stdout: string): unknown {
    const lines = stdout.split(/\r?\n/).filter((line) => line.startsWith("TTSC_BATCH:"));
    assert.equal(lines.length, 1, "exactly one source program result is required");
    return JSON.parse(lines[0]!.slice("TTSC_BATCH:".length));
  }

  /** Keep uncertain process inputs rather than deleting them at runner exit. */
  export function retain(reason: string): void {
    if (preparation !== undefined)
      void preparation.then(({ root }) => TestProject.retainTemporaryDirectory(root, reason));
  }

  /** Release shared inputs only after all consumers have returned. */
  export async function close(): Promise<void> {
    if (preparation === undefined) return;
    const { root } = await preparation;
    if (!fs.existsSync(root)) return;
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }

  async function prepare(): Promise<Workspace> {
    const root = TestProject.tmpdir("ttsc-shared-boundaries-");
    // Retain throughout the run. The runner explicitly releases only its own
    // completed consumers; a rejected or unknown lifetime keeps all inputs.
    TestProject.retainTemporaryDirectory(root, "Shared boundary consumers have not completed");
    const inputs = await FileSystemIterator.read(path.resolve(import.meta.dirname, "../../fixtures/shared"));
    await FileSystemIterator.write(root, inputs);
    const installationOnly = process.argv.includes("--installation");
    const target = `${process.platform}-${process.arch}`;
    const pnpm = (args: string[], cwd: string): void => {
      execFileSync("pnpm", args, { cwd, shell: process.platform === "win32", stdio: "inherit" });
    };
    for (const name of ["ttsc", `ttsc-${target}`])
      pnpm(["pack", "--out", path.join(root, `${name}.tgz`)], path.join(TestProject.WORKSPACE_ROOT, "packages", name));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
      private: true, type: "commonjs",
      dependencies: { ttsc: "file:./ttsc.tgz", [`@ttsc/${target}`]: `file:./ttsc-${target}.tgz`, typescript: "7.0.2" },
    }));
    pnpm(["install", "--ignore-scripts", "--no-frozen-lockfile"], root);
    const installed = createRequire(path.join(root, "package.json"));
    const sdk = path.dirname(installed.resolve("ttsc/package.json"));
    assert.equal(fs.realpathSync.native(sdk).startsWith(fs.realpathSync.native(root) + path.sep), true, "SDK must resolve inside the owned installed consumer");
    const installedTtsx = path.join(sdk, "lib/launcher/ttsx.js");
    assert.ok(fs.existsSync(installedTtsx), "packed SDK must publish its actual runtime launcher");
    const modules = path.join(root, "node_modules");
    if (!installationOnly) prepareEvidenceDependencies(modules, "snapshot", "installed");
    for (const name of installationOnly ? [] : ["banner", "paths", "strip", "wasm", "playground", "unplugin"])
      fs.symlinkSync(path.join(TestProject.WORKSPACE_ROOT, "packages", name), path.join(modules, "@ttsc", name), "junction");
    for (const name of ["path-dependency", "trace-dependency"]) {
      const target = path.join(modules, name);
      fs.mkdirSync(target, { recursive: true });
      for (const filename of ["package.json", "index.d.ts"])
        fs.copyFileSync(path.join(root, "vendor", name, filename), path.join(target, filename));
    }
    const programRunLog = path.join(root, "program-runs.bin");
    if (!installationOnly)
      for (const name of ["cjs-dep", "esm-dep"])
        fs.symlinkSync(path.join(root, "src/runtime-corpus/dual", name), path.join(modules, name), "junction");
    if (!installationOnly) {
      const configPath = path.join(root, "tsconfig.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.compilerOptions.plugins.push({ name: "shared-real-program-probe", transform: "./compile-probe.cjs", fixtureSource: path.join(TestProject.WORKSPACE_ROOT, "packages/unplugin/test/fixtures/compile-probe"), runLog: programRunLog, prefix: "a:", suffix: ":z" });
      fs.writeFileSync(configPath, JSON.stringify(config));
      const loaderPath = path.join(root, "typed-loader.cjs");
      fs.writeFileSync(loaderPath, fs.readFileSync(loaderPath, "utf8").replace("__ESBUILD_ENTRY__", createRequire(import.meta.url).resolve("esbuild").replace(/\\/g, "/")));
    }
    if (!installationOnly)
      await FileSystemIterator.write(root, { "adapter-entries.json": JSON.stringify(["farm", "rolldown", "rspack", "webpack"].map((name) => pathToFileURL(TestUnpluginRuntime.libPath(name, "mjs")).href)) });
    const { source, expected } = printedValues();
    await FileSystemIterator.write(root, { "src/factory-values.tsx": source });
    const bunEntry = fs.readFileSync(path.join(root, "bun-entry.mjs"), "utf8");
    fs.writeFileSync(path.join(root, "bun-entry.mjs"), bunEntry.replace("__BUN_ADAPTER__", pathToFileURL(TestUnpluginRuntime.libPath("bun", "mjs")).href));
    if (installationOnly) {
      fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "commonjs", strict: true, jsx: "react", jsxFactory: "jsx", types: [], plugins: [] }, include: ["src/contract.ts", "src/factory-values.tsx", "src/installation-runtime.ts"] }));
    }
    return { root, expected, installedTtsx, installationOnly, programRunLog, cache: TestProject.sharedPluginCache() };
  }

  /** The original factory matrix supplies inputs before any printer runs. */
  function printedValues(): { source: string; expected: Workspace["expected"] } {
    const cases: [string, string][] = [
      ["empty", ""], ["plain", "plain text"], ["double quote", 'say "hello"'],
      ["single quote", "it's text"], ["both quotes", `"'`], ["ampersand", "a&b"],
      ["named entity text", "&quot;&amp;&apos;"], ["numeric entity text", "&#13;&#x2028;"],
      ["unknown entity text", "&unknown;"], ["backslash", "a\\b\\n\\\""],
      ["markup", "<tag>{text}>"], ["CRLF", "a\r\nb"], ["CR", "a\rb"], ["LF", "a\nb"],
      ["LS", "a\u2028b"], ["PS", "a\u2029b"], ["DEL", "a\x7fb"],
      ["high surrogate start", "a\ud800b"], ["high surrogate end", "a\udbffb"],
      ["low surrogate start", "a\udc00b"], ["low surrogate end", "a\udfffb"],
      ["astral pair", "a\u{1f600}b"],
      ...Array.from({ length: 32 }, (_, code): [string, string] => [`C0 ${code}`, `a${String.fromCharCode(code)}b`]),
      ["combined payload", "\0\r\n\u2028\ud800\udfff&quot;\\n\""],
    ];
    const expected: { title: string; units: number[] }[] = [];
    const printed: string[] = [];
    for (const [name, value] of cases)
      for (const singleQuote of [false, true])
        for (const printWidth of [1, 200]) {
          const printer = new TsPrinter({ printWidth });
          const literal = factory.createStringLiteral(value, singleQuote);
          for (const kind of ["attribute", "expression", "ordinary"]) {
            const title = `${name}, singleQuote=${singleQuote}, width=${printWidth}, context=${kind}`;
            expected.push({ title, units: value.split("").map((unit) => unit.charCodeAt(0)) });
            const node = kind === "ordinary" ? literal : factory.createJsxSelfClosingElement(
              factory.createIdentifier("div"), undefined, factory.createJsxAttributes([
                factory.createJsxAttribute(factory.createIdentifier("value"), kind === "expression" ? factory.createJsxExpression(undefined, literal) : literal),
              ]));
            printed.push(printer.print(node));
          }
        }
    expected.push({ title: "independent numeric-entity specimen", units: [0, 13, 10, 8232, 55296, 57343, 38, 113, 117, 111, 116, 59, 92, 110, 34] });
    printed.push('<div value="&#0;&#13;&#10;&#8232;&#55296;&#57343;&amp;quot;\\n&quot;" />');
    return { expected, source: [
      "declare global { namespace JSX { interface IntrinsicElements { div: { value: string } } } }",
      "function jsx(_tag: string, props: { value: string }): string { return props.value; }",
      `export const values = [${printed.join(",\n")}];`,
    ].join("\n") };
  }
}











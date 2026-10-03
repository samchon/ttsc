import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import factory, { TsPrinter } from "../../../../../../packages/factory/src/index";
import { buildNativeCompiler } from "../../../../../../packages/ttsc/lib/compiler/internal/buildNativeCompiler.js";

/**
 * Verifies factory string values survive native JSX parsing and emission.
 *
 * The native compiler consumes UTF-8 source and decodes quoted JSX entities;
 * a JavaScript reference parser alone cannot establish that connection. One
 * program carries all string rows, so a failed value cannot hide another row.
 *
 * 1. Print quoted JSX attributes, expression attributes and ordinary strings
 *    for both quote styles and widths, then write one actual TSX project.
 * 2. Compile through the shared native API host and evaluate its emitted JS,
 *    comparing every UTF-16 unit with the independently authored input values.
 * 3. Reuse that executable for invalid JSX and require a source syntax error.
 *
 * Formal verification may supply its identity-checked native executable and
 * observe both complete process results; ordinary discovery uses the shared
 * current-source compiler cache.
 *
 * @evidence contracts/testing.md#behavioral-verification The real api-compile process emits the printer's UTF-8 TSX; V8 evaluates all emitted values and their exact UTF-16 units must match inputs. Invalid JSX must produce a nonzero exit and source error diagnostics.
 * @evidence contracts/testing.md#independent-expectations Literal input strings and unit iteration establish expected values before printing. V8 interprets native emitted JavaScript independently; the malformed authored attribute establishes the negative grammar case.
 * @evidence contracts/testing.md#distinguishing-cases Fifty-four empty, punctuation, entity, control, newline, separator and surrogate inputs cross both quote styles, widths 1/200 and three contexts. A combined payload and independently authored numeric-entity specimen additionally cover adjacent surrogate units and literal entity/backslash text; invalid JSX remains rejected.
 * @evidence contracts/testing.md#execution-ownership This named API feature is discovered by TestExecutor and owns all row failures, real native compile calls and returned output evaluation. The consolidated compiler entry supplies its empty physical project root and invokes the same matrix before CLI staging.
 * @evidence contracts/e2e.md#necessary-boundary Factory output must cross UTF-8, the pinned Go parser/emitter and JSON output transport without altering cooked string values. The separate factory source unit owns reference TypeScript parsing; it cannot prove native entity decoding.
 * @evidence contracts/e2e.md#shared-execution One selected executable path from the shared builder or supplied caller serves positive and negative compile invocations, not a per-row producer. Consolidated execution writes the same two authored files into the prior API project's empty physical root; the builder still performs its original artifact admission. This body does not independently verify executable bytes, cache hits or loaded image; prepared manifests and actual process/construction observations remain separate.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One tracked or borrowed empty project owns source/config and rejects positive disk emission. Borrowed execution refuses source replacement after error/signal/null-status, retaining uncertainty and blocking later phases; ordinary assertion failures still allow the negative observation after a settled response. Synchronous results do not certify arbitrary descendant shutdown. Standalone root removal and its errors remain; a borrowed root is retained by the outer family. Shared cache ownership is separate.
 * @evidence contracts/e2e.md#preserved-coverage This native batch retains the original 54-string matrix plus combined payload across twelve combinations and the independent entity specimen, all 661 value expectations and invalid status2/main.tsx error1002. tests/test-factory/src/features/printer/test_printer_preserves_jsx_attribute_values.ts directly owns the separate legacy TypeScript/V8 reference route, now expanded beyond its original648 checks. That source body does not replace native decoding or certify current runtime survival.
 */
export const test_factory_jsx_strings_roundtrip_through_native_compile = (
  nativeCompiler?: string,
  observe?: (receipt: {
    binary: string;
    root: string;
    phase: "positive" | "negative";
    status: number | null;
    stdout: string;
    stderr: string;
  }) => void,
  preparedRoot?: string,
): void => {
  const cases: [string, string][] = [
    ["empty", ""],
    ["plain", "plain text"],
    ["double quote", 'say "hello"'],
    ["single quote", "it's text"],
    ["both quotes", `"'`],
    ["ampersand", "a&b"],
    ["named entity text", "&quot;&amp;&apos;"],
    ["numeric entity text", "&#13;&#x2028;"],
    ["unknown entity text", "&unknown;"],
    ["backslash", "a\\b\\n\\\""],
    ["markup", "<tag>{text}>"],
    ["CRLF", "a\r\nb"],
    ["CR", "a\rb"],
    ["LF", "a\nb"],
    ["LS", "a\u2028b"],
    ["PS", "a\u2029b"],
    ["DEL", "a\x7fb"],
    ["high surrogate start", "a\ud800b"],
    ["high surrogate end", "a\udbffb"],
    ["low surrogate start", "a\udc00b"],
    ["low surrogate end", "a\udfffb"],
    ["astral pair", "a\u{1f600}b"],
    ...Array.from({ length: 32 }, (_, code): [string, string] => [
      `C0 ${code}`,
      `a${String.fromCharCode(code)}b`,
    ]),
    ["combined payload", "\0\r\n\u2028\ud800\udfff&quot;\\n\""],
  ];
  const expected: { title: string; units: number[] }[] = [];
  const printed: string[] = [];
  for (const [name, value] of cases)
    for (const singleQuote of [false, true])
      for (const printWidth of [1, 200]) {
        const printer = new TsPrinter({ printWidth });
        const literal = factory.createStringLiteral(value, singleQuote);
        for (const context of ["attribute", "expression", "ordinary"]) {
          const title = `${name}, singleQuote=${singleQuote}, width=${printWidth}, context=${context}`;
          const node =
            context === "ordinary"
              ? literal
              : factory.createJsxSelfClosingElement(
                factory.createIdentifier("div"),
                undefined,
                factory.createJsxAttributes([
                  factory.createJsxAttribute(
                    factory.createIdentifier("value"),
                    context === "expression"
                      ? factory.createJsxExpression(undefined, literal)
                      : literal,
                  ),
                ]),
                );
          expected.push({
            title,
            units: value.split("").map((unit) => unit.charCodeAt(0)),
          });
          printed.push(printer.print(node));
        }
      }
  expected.push({
    title: "independent numeric-entity specimen",
    units: [
      0, 13, 10, 8232, 55296, 57343, 38, 113, 117, 111, 116, 59, 92, 110, 34,
    ],
  });
  printed.push(
    '<div value="&#0;&#13;&#10;&#8232;&#55296;&#57343;&amp;quot;\\n&quot;" />',
  );
  const files = {
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        jsx: "react",
        jsxFactory: "jsx",
        outDir: "dist",
        types: [],
      },
      include: ["main.tsx"],
    }),
    "main.tsx": [
      "declare namespace JSX { interface IntrinsicElements { div: { value: string } } }",
      "function jsx(_tag: string, props: { value: string }): string { return props.value; }",
      `const values = [${printed.join(",\n")}];`,
    ].join("\n"),
  };
  const root = preparedRoot ?? TestProject.createProject(files);
  if (preparedRoot !== undefined) {
    assert.deepEqual(fs.readdirSync(root), [], "borrowed JSX input root must be empty");
    for (const [name, bytes] of Object.entries(files))
      fs.writeFileSync(path.join(root, name), bytes);
  }
  const failures: string[] = [];
  let inputsSettled = true;
  try {
    const binary =
      nativeCompiler ??
      buildNativeCompiler({
        cacheBaseDir: root,
        cacheDir: TestProject.sharedPluginCache(),
        packageRoot: path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc"),
      });
    try {
      const result = TestProject.spawn(
        binary,
        ["api-compile", "--cwd", root, "--tsconfig", "tsconfig.json"],
        { cwd: root },
      );
      if (preparedRoot !== undefined && (result.error || result.signal !== null || result.status === null)) {
        inputsSettled = false;
        throw new Error("Positive JSX transport did not settle for shared input replacement");
      }
      observe?.({
        binary, root, phase: "positive", status: result.status,
        stdout: result.stdout, stderr: result.stderr,
      });
      const envelope = JSON.parse(result.stdout);
      if (result.status !== 0)
        failures.push(
          `positive native status=${result.status}: ${result.stderr || result.stdout}`,
        );
      if ((envelope.diagnostics ?? []).length !== 0)
        failures.push(
          `positive native diagnostics: ${JSON.stringify(envelope.diagnostics)}`,
        );
      assert.equal(typeof envelope.output["dist/main.js"], "string");
      const actual: unknown = new Function(
        `${envelope.output["dist/main.js"]}\nreturn values;`,
      )();
      assert.ok(Array.isArray(actual));
      if (actual.length !== expected.length)
        failures.push(
          `native value count=${actual.length}, expected=${expected.length}`,
        );
      for (let i = 0; i < expected.length; i++) {
        const row = expected[i]!;
        const value: unknown = actual[i];
        try {
          assert.equal(typeof value, "string", row.title);
          assert.deepEqual(
            (value as string).split("").map((unit) => unit.charCodeAt(0)),
            row.units,
            row.title,
          );
        } catch (error) {
          failures.push(String(error));
        }
      }
      assert.equal(fs.existsSync(path.join(root, "dist")), false);
    } catch (error) {
      failures.push(`positive native compile: ${String(error)}`);
    }
    try {
      if (!inputsSettled)
        throw new Error("Negative JSX input replacement blocked by unsettled positive transport");
      fs.writeFileSync(
        path.join(root, "main.tsx"),
        'const value = <div value="broken"quote" />;\n',
      );
      const result = TestProject.spawn(
        binary,
        ["api-compile", "--cwd", root, "--tsconfig", "tsconfig.json"],
        { cwd: root },
      );
      if (preparedRoot !== undefined && (result.error || result.signal !== null || result.status === null)) {
        inputsSettled = false;
        throw new Error("Negative JSX transport did not settle for shared input replacement");
      }
      observe?.({
        binary, root, phase: "negative", status: result.status,
        stdout: result.stdout, stderr: result.stderr,
      });
      assert.equal(result.status, 2, result.stderr || result.stdout);
      const envelope = JSON.parse(result.stdout);
      assert.ok(
        envelope.diagnostics.some((diagnostic: {
          category: string;
          file: string | null;
          code: number;
        }) => diagnostic.category === "error" &&
          diagnostic.file?.endsWith("main.tsx") && diagnostic.code === 1002),
      );
    } catch (error) {
      failures.push(`negative native compile: ${String(error)}`);
    }
  } catch (error) {
    failures.push(`native compiler preparation: ${String(error)}`);
  } finally {
    try {
      if (preparedRoot === undefined)
        fs.rmSync(root, { recursive: true, force: true });
    } catch (error) {
      failures.push(`native fixture cleanup: ${String(error)}`);
    }
  }
  assert.equal(failures.length, 0, failures.join("\n"));
};

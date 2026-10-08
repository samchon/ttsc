import assert from "node:assert/strict";

import { parseNativeTransformOutput } from "../../../../../packages/ttsc/src/compiler/internal/parseNativeTransformOutput";
import {
  classifyException,
  normalizeError,
  runProject,
  runTransformation,
  toCompilerTransformation,
} from "../../../../../packages/ttsc/src/internal/CompilerResultAdapter";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verify the production result adapter's outcome and observation policy.
 * Authored task records are policy inputs, not native compiler observations.
 * Real decoder outputs exercise the decoder-to-adapter connection in process.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls production-used runProject/runTransformation/toCompilerTransformation and normalizeError/classifyException, including actual decoder outputs and thrown decoder errors. Literal status/category outcomes, process diagnostics, callback counts and source/advisory reference identity distinguish adaptation decisions.
 * @evidence contracts/testing.md#independent-expectations Authored exit statuses, diagnostic categories, source text, error prefixes and literal optional fields define expected envelopes without a fake producer or compiler-derived expected snapshot.
 * @evidence contracts/testing.md#distinguishing-cases Empty success omits diagnostics; warnings retain identity, errors/nonzero fail, empty failures select stderr/stdout/status text. Undefined observations omit fields while empty records/lists and false survive success and failure. Malformed source/JSON exceptions, plugin-before-host precedence, data-message versus getter and revoked inspection remain distinct.
 * @evidence contracts/testing.md#execution-ownership This one exported unit invokes actual source operations synchronously with owned in-memory data. It starts no task worker, native producer, compiler or process and opens no fixture file. Native stdout/worker/context/acquisition/public API bootstrap are not certified by its callback or parser inputs.
 */
export function test_compiler_result_adapter_preserves_outcomes_and_observation_references(): void {
  type Compile = ReturnType<Parameters<typeof runProject>[0]>;
  type Transform = ReturnType<Parameters<typeof runTransformation>[0]>;
  type Diagnostic = Compile["result"]["diagnostics"][number];
  const failures: Error[] = [];
  const check = (name: string, body: () => void): void => {
    try {
      body();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const warning: Diagnostic = {
    category: "warning",
    code: 9001,
    file: null,
    messageText: "advice",
  };
  const error: Diagnostic = {
    category: "error",
    code: 2322,
    file: "src/main.ts",
    messageText: "not assignable",
  };
  for (const [name, status, diagnostics, expected] of [
    ["empty success", 0, [], "success"],
    ["warning success", 0, [warning], "success"],
    ["error failure", 0, [error], "failure"],
    ["nonzero warning failure", 7, [warning], "failure"],
  ] satisfies [string, number, Diagnostic[], "success" | "failure"][])
    check(name, () => {
      const output = { "dist/main.js": 'exports.value = "literal";\n' };
      const result: Compile["result"] = {
        status,
        diagnostics,
        stdout: "",
        stderr: "",
      };
      let calls = 0;
      const actual = runProject(() => {
        calls += 1;
        return { output, result };
      });
      assert.equal(calls, 1);
      if (actual.type === "exception") throw new Error("unexpected exception");
      assert.equal(actual.type, expected);
      assert.equal(actual.output, output);
      assert.equal(
        Object.hasOwn(actual, "diagnostics"),
        diagnostics.length !== 0,
      );
      if (diagnostics.length !== 0)
        assert.equal(actual.diagnostics, diagnostics);
      const typescript = { "src/main.ts": "export const value = 1;\n" };
      const transformed = runTransformation(() => {
        calls += 1;
        return { result, typescript };
      });
      assert.equal(calls, 2);
      if (transformed.type === "exception")
        throw new Error("unexpected transform exception");
      assert.equal(transformed.type, expected);
      assert.equal(transformed.typescript, typescript);
      assert.equal(
        Object.hasOwn(transformed, "diagnostics"),
        diagnostics.length !== 0,
      );
      if (diagnostics.length !== 0)
        assert.equal(transformed.diagnostics, diagnostics);
    });
  for (const [stdout, stderr, expected] of [
    ["out", "  native failure\n", "native failure"],
    ["  stdout failure\n", "", "stdout failure"],
    ["", "", "ttsc exited with status 7"],
  ] as const)
    check(`empty failure/${expected}`, () => {
      const result = { status: 7, diagnostics: [], stdout, stderr };
      const expectedDiagnostics = [
        {
          category: "error",
          code: "TTSC_PROCESS",
          file: null,
          messageText: expected,
        },
      ];
      const compiled = runProject(() => ({ output: {}, result }));
      const transformed = runTransformation(() => ({ typescript: {}, result }));
      assert.equal(compiled.type, "failure");
      assert.equal(transformed.type, "failure");
      if (compiled.type !== "failure" || transformed.type !== "failure")
        throw new Error("missing failure");
      assert.deepEqual(compiled.diagnostics, expectedDiagnostics);
      assert.deepEqual(transformed.diagnostics, expectedDiagnostics);
    });
  const advisory = {
    dependencies: {},
    dependenciesComplete: [],
    graph: { configs: [], edges: {}, globals: [] },
    hostInputHashes: {},
    hostInputProofFailures: {},
    hostInputRealpaths: {},
    hostInputs: [],
    observationsComplete: false,
    pluginSources: {},
    sourceMaps: {},
    volatile: [],
  } satisfies Omit<Transform, "result" | "typescript">;
  for (const status of [0, 7])
    check(`advisory identity/${status}`, () => {
      const project: Transform = {
        ...advisory,
        typescript: {},
        result: { status, diagnostics: [], stdout: "", stderr: "" },
      };
      const actual = toCompilerTransformation(project);
      if (actual.type === "exception") throw new Error("unexpected exception");
      assert.equal(actual.type, status === 0 ? "success" : "failure");
      assert.equal(actual.typescript, project.typescript);
      for (const key of [
        "dependencies",
        "dependenciesComplete",
        "graph",
        "hostInputHashes",
        "hostInputProofFailures",
        "hostInputRealpaths",
        "hostInputs",
        "observationsComplete",
        "pluginSources",
        "sourceMaps",
        "volatile",
      ] as const) {
        assert.equal(Object.hasOwn(actual, key), true, key);
        assert.equal(actual[key], project[key], key);
      }
      const omitted = toCompilerTransformation({
        typescript: {},
        result: project.result,
      });
      for (const key of Object.keys(advisory))
        assert.equal(Object.hasOwn(omitted, key), false, key);
    });
  check("actual valid and filtered decoder records", () => {
    const valid = parseNativeTransformOutput(
      JSON.stringify(NativeTransformEnvelopeFixture.valid),
      "",
    );
    const actual = runTransformation(() => ({
      ...valid,
      result: {
        status: 0,
        diagnostics: valid.diagnostics,
        stdout: "",
        stderr: "",
      },
    }));
    if (actual.type === "exception") throw new Error("unexpected exception");
    assert.equal(actual.type, "success");
    assert.deepEqual(actual.dependencies, {
      "src/main.ts": ["src/consulted.d.ts"],
    });
    assert.deepEqual(actual.graph, {
      configs: ["tsconfig.json"],
      edges: { "src/main.ts": ["src/mytype.ts"] },
      globals: ["src/ambient.d.ts"],
    });
    assert.equal(actual.typescript, valid.typescript);
    assert.equal(actual.graph, valid.graph);
    const filtered = parseNativeTransformOutput(
      JSON.stringify(NativeTransformEnvelopeFixture.malformedAdvisory),
      "",
    );
    const adapted = toCompilerTransformation({
      ...filtered,
      result: { status: 0, diagnostics: [], stdout: "", stderr: "" },
    });
    if (adapted.type === "exception") throw new Error("unexpected exception");
    assert.equal(adapted.type, "success");
    assert.deepEqual(adapted.dependenciesComplete, ["src/main.ts"]);
    assert.equal(Object.hasOwn(adapted, "volatile"), false);
    assert.deepEqual(Object.keys(adapted.sourceMaps ?? {}), ["src/main.ts"]);
    assert.equal(adapted.sourceMaps, filtered.sourceMaps);
  });
  for (const [input, stderr, expected, kind] of [
    [
      JSON.stringify(NativeTransformEnvelopeFixture.missingSource),
      "",
      "ttsc: native transform host did not return a TypeScript source map",
      "host",
    ],
    [
      JSON.stringify(NativeTransformEnvelopeFixture.arraySource),
      "",
      "ttsc: native transform host did not return a TypeScript source map",
      "host",
    ],
    ["{", "native JSON failure", "native JSON failure", "unknown"],
  ] as const)
    check(`decoder exception/${input}`, () => {
      let calls = 0;
      const actual = runTransformation(() => {
        calls += 1;
        const parsed = parseNativeTransformOutput(input, stderr);
        return {
          ...parsed,
          result: { status: 0, diagnostics: [], stdout: "", stderr: "" },
        };
      });
      assert.equal(calls, 1);
      assert.equal(actual.type, "exception");
      if (actual.type !== "exception") throw new Error("missing exception");
      assert.equal(actual.kind, kind);
      assert.ok(actual.error !== null && typeof actual.error === "object");
      assert.equal(
        Object.getOwnPropertyDescriptor(actual.error, "message")?.value,
        expected,
      );
    });
  check("exception classification and serialization", () => {
    for (const [message, expected] of [
      ['ttsc: plugin "literal" failed', "plugin"],
      ["ttsc.transform.check: failed", "plugin"],
      ["ttsc: native compiler host missing at /plugins/host", "host"],
      ["ordinary failure", "unknown"],
    ] as const)
      assert.equal(classifyException({ message }), expected);
    let reads = 0;
    const accessor = Object.defineProperty({}, "message", {
      get() {
        reads += 1;
        return "ttsc: host";
      },
    });
    assert.equal(classifyException(accessor), "unknown");
    assert.equal(reads, 0);
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    assert.equal(classifyException(revoked.proxy), "unknown");
    assert.deepEqual(normalizeError(revoked.proxy), {
      $ttscValue: "uninspectable-object",
    });
    const thrown = new Error('ttsc: plugin "literal" failed', {
      cause: "origin",
    });
    Object.defineProperty(thrown, "stack", { value: "literal-stack" });
    const actual = runProject(() => {
      throw thrown;
    });
    assert.deepEqual(actual, {
      type: "exception",
      kind: "plugin",
      error: {
        message: 'ttsc: plugin "literal" failed',
        name: "Error",
        stack: "literal-stack",
        cause: "origin",
      },
    });
  });
  if (failures.length !== 0)
    throw new AggregateError(failures, "compiler result adaptation failures");
}

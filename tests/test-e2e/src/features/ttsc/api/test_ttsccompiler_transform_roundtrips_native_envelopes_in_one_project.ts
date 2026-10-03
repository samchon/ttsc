import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeBasicProject,
} from "../../../internal/ttsc/internal/compiler";
import { NativeTransformEnvelopeFixture } from "../../../internal/ttsc/internal/NativeTransformEnvelopeFixture";

/**
 * Verifies the native transform transport and API publish decoded envelopes.
 *
 * Direct decoder operations own portable wire-shape decisions; their exact
 * coverage and actual survival must be established separately. One Go producer
 * retains source compilation, stdout transport, advisory-field propagation,
 * API exception classification and the no-output-publication boundary. Only
 * the runtime response changes; the same compiled producer is reused.
 *
 * 1. Build one Go producer that reads the owning project's response file.
 * 2. Transform valid and malformed advisory responses and check their API fields.
 * 3. Transform both rejected source shapes and verify exceptions without emit.
 *
 * @evidence contracts/testing.md#behavioral-verification Five response shapes cross the actual compiled Go stdout transport into TtscCompiler.transform: valid metadata, malformed optional metadata, resolution candidates and two rejected source shapes. Exact API maps and rejection/no-dist assertions distinguish lost fields or publication after malformed output.
 * @evidence contracts/testing.md#independent-expectations Authored literal response fields and the decoder's supported wire contract determine the expected maps and exception message. Direct decoder contributions are separate owners, not blanket proof that every advisory branch has an executed survivor. No native result is used to manufacture the literal expectations.
 * @evidence contracts/testing.md#distinguishing-cases Valid source and advisory subsets remain accepted, malformed optional fields are filtered, candidates remain ordered and distinct from selected edges, while missing or array-valued source maps reject without emission. All five cases execute even after an earlier assertion fails.
 * @evidence contracts/testing.md#execution-ownership This named API E2E owns the real Go producer-to-transform connection; NativeTransformEnvelopeFixture holds inputs and decoder units own portable shape decisions. This named invocation collects all five response verdicts using the checkout built API and selected native compiler; it is not packed installation or independent executable image/build-provenance validation.
 * @evidence contracts/e2e.md#necessary-boundary Direct decoder calls cannot detect Go compilation, transform command flags, stdout transport or API exception/publication wiring. This single producer retains that assembly boundary for the former envelope and candidate consumers.
 * @evidence contracts/e2e.md#shared-execution One immutable Go program and compiler/project serve five runtime JSON responses. Consolidated execution borrows the empty API allocation after prior external-config inputs move aside, writing the same source/config/package/producer. Source bytes and keyed preparation inputs stay fixed between responses, without certifying cache hits, exact build/child counts, a persistent Program or loaded image.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each transform replaces the complete response before synchronous execution. Standalone owns a fresh project; borrowed execution requires an empty root and exact original inputs with no dist, preventing rejected responses from inheriting output. The outer family retains borrowed inputs and the source cache keeps its separate owner. Direct synchronous results do not certify arbitrary descendants or interruption cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original valid, malformed advisory, missing-source and array-source assertions remain. The exact candidate graph assertion is retained here as a fifth real transport response and its separate direct decoder contribution must be mapped/selected/executed before removing a meaningful duplicate. This current connection does not certify an already executed decoder survivor or authorize another producer removal.
 */
export function test_ttsccompiler_transform_roundtrips_native_envelopes_in_one_project(preparedRoot?: string) {
    const root = preparedRoot ?? createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    if (preparedRoot !== undefined) {
      assert.deepEqual(fs.readdirSync(root), [], "borrowed native-envelope root must be empty");
      writeBasicProject(root, 'export const value = goUpper("plugin");\nconsole.log(value);\n', {
        plugins: [{ transform: "./plugin.cjs" }],
      });
      fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ private: true }), "utf8");
    }
    fs.writeFileSync(
      path.join(root, "plugin.cjs"),
      'module.exports = { name: "native-envelope-transport", source: "./plugin-go" };\n',
    );
    const pluginRoot = path.join(root, "plugin-go");
    fs.mkdirSync(pluginRoot);
    fs.writeFileSync(
      path.join(pluginRoot, "go.mod"),
      "module example.com/nativeenvelopetransport\n\ngo 1.26\n",
    );
    fs.writeFileSync(
      path.join(pluginRoot, "main.go"),
      [
        "package main",
        'import ("flag"; "fmt"; "os"; "path/filepath")',
        "func main() {",
        '  if len(os.Args) < 2 || os.Args[1] != "transform" { os.Exit(2) }',
        '  flags := flag.NewFlagSet("transform", flag.ExitOnError)',
        '  cwd := flags.String("cwd", "", "")',
        '  flags.String("tsconfig", "", "")',
        '  flags.String("plugins-json", "", "")',
        "  flags.Parse(os.Args[2:])",
        '  input, err := os.ReadFile(filepath.Join(*cwd, "native-envelope.json"))',
        "  if err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(2) }",
        "  fmt.Println(string(input))",
        "}",
        "",
      ].join("\n"),
    );
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });
    const transform = (response: unknown) => {
      fs.writeFileSync(
        path.join(root, "native-envelope.json"),
        JSON.stringify(response),
      );
      return compiler.transform();
    };

    const failures: Error[] = [];
    const check = (name: string, verify: () => void) => {
      try { verify(); }
      catch (error) { failures.push(new Error(name, { cause: error })); }
    };
    check("valid metadata", () => {
    const valid = transform(NativeTransformEnvelopeFixture.valid);
    assert.equal(valid.type, "success");
    if (valid.type !== "success") throw new Error("native envelope transport failed");
    assert.deepEqual(valid.typescript, NativeTransformEnvelopeFixture.valid.typescript);
    assert.deepEqual(valid.dependencies, { "src/main.ts": ["src/consulted.d.ts"] });
    assert.deepEqual(valid.dependenciesComplete, ["src/main.ts"]);
    assert.deepEqual(valid.graph, {
      configs: ["tsconfig.json"],
      edges: { "src/main.ts": ["src/mytype.ts"] },
      globals: ["src/ambient.d.ts"],
    });
    assert.deepEqual(valid.volatile, ["src/volatile.ts"]);
    });

    check("malformed advisory metadata", () => {
    const advisory = transform(NativeTransformEnvelopeFixture.malformedAdvisory);
    assert.equal(advisory.type, "success");
    if (advisory.type !== "success") throw new Error("advisory envelope transport failed");
    assert.deepEqual(advisory.dependenciesComplete, ["src/main.ts"]);
    assert.equal(advisory.volatile, undefined);
    assert.deepEqual(advisory.graph, {
      configs: ["tsconfig.json"],
      edges: { "src/main.ts": ["src/good.d.ts"], "src/worse.ts": [] },
      globals: [],
      inputHashes: { "src/good.d.ts": "a".repeat(64), "src/missing.d.ts": null },
      inputObservations: {
        "src/good.d.ts": { fileExists: true },
        "src/missing.d.ts": { directoryExists: true, fileExists: false },
      },
      inputProofFailures: FixtureFiles.read("ttsc/ttsccompiler_transform_roundtrips_native_envelopes_in_one_project/inputs-1"),
      inputRealpaths: { "src/good.d.ts": null, "src/missing.d.ts": null },
    });
    assert.deepEqual(advisory.sourceMaps, {
      "src/main.ts": {
        file: "main.ts", mappings: "AAAA", names: [], sources: ["main.ts"],
        sourcesContent: ["export const value = 1\n"], version: 3,
      },
    });
    });

    check("resolution candidates", () => {
      const candidates = transform(NativeTransformEnvelopeFixture.resolutionCandidates);
      assert.equal(candidates.type, "success");
      if (candidates.type !== "success") throw new Error("candidate envelope transport failed");
      assert.deepEqual(candidates.graph, NativeTransformEnvelopeFixture.resolutionCandidates.graph);
    });

    for (const response of [
      NativeTransformEnvelopeFixture.missingSource,
      NativeTransformEnvelopeFixture.arraySource,
    ]) {
      check(response === NativeTransformEnvelopeFixture.missingSource ? "missing sources" : "array sources", () => {
      const rejected = transform(response);
      assert.equal(rejected.type, "exception");
      if (rejected.type !== "exception") throw new Error("invalid envelope accepted");
      assert.match(
        (rejected.error as Error).message,
        /did not return a TypeScript source map/,
      );
      assert.equal(fs.existsSync(path.join(root, "dist")), false);
      });
    }
    if (failures.length) throw new AggregateError(failures, "native envelope cases failed");
  }

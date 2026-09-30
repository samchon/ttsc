import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
} from "../../internal/compiler";
import { NativeTransformEnvelopeFixture } from "../../internal/NativeTransformEnvelopeFixture";

/**
 * Verifies the native transform transport and API publish decoded envelopes.
 *
 * Decoder units own every wire-shape assertion. One actual Go source producer
 * retains source compilation, stdout transport, advisory-field propagation,
 * API exception classification and the no-output-publication boundary. Only
 * the runtime response changes; the same compiled producer is reused.
 *
 * 1. Build one Go producer that reads the owning project's response file.
 * 2. Transform valid and malformed advisory responses and check their API fields.
 * 3. Transform both rejected source shapes and verify exceptions without emit.
 */
export const test_ttsccompiler_transform_roundtrips_native_envelopes_in_one_project =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
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
      inputProofFailures: {
        "src/bad.d.ts": "malformed-observation",
        "src/missing.d.ts": "content-unavailable",
        "src/worse.d.ts": "conflicting-observation",
      },
      inputRealpaths: { "src/good.d.ts": null, "src/missing.d.ts": null },
    });
    assert.deepEqual(advisory.sourceMaps, {
      "src/main.ts": {
        file: "main.ts", mappings: "AAAA", names: [], sources: ["main.ts"],
        sourcesContent: ["export const value = 1\n"], version: 3,
      },
    });

    for (const response of [
      NativeTransformEnvelopeFixture.missingSource,
      NativeTransformEnvelopeFixture.arraySource,
    ]) {
      const rejected = transform(response);
      assert.equal(rejected.type, "exception");
      if (rejected.type !== "exception") throw new Error("invalid envelope accepted");
      assert.match(
        (rejected.error as Error).message,
        /did not return a TypeScript source map/,
      );
      assert.equal(fs.existsSync(path.join(root, "dist")), false);
    }
  };

import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  fs,
  path,
  tsgo,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform returns every included TypeScript source
 * file.
 *
 * Bundler adapters need the full source map to feed their own compilation
 * pipeline — they cannot assume a single entry file. `transform()` must return
 * all `.ts` files that are part of the tsconfig `include`, not just the entry.
 * Also pins that no output keys carry a `.js`, `.d.ts`, or `.map` extension,
 * since `transform()` is a source-only operation.
 *
 * 1. Create a project with an entry, a helper module, and a nested interface file.
 * 2. Call `transform()` via the programmatic API with `plugins: false`.
 * 3. Assert all three `.ts` files appear in the result and no JS/declaration keys
 *    exist.
 *
 * @evidence contracts/testing.md#behavioral-verification Transforms main.ts, imported helpers.ts and unreferenced nested/model.ts, checking their literal contents and rejecting every dist or emitted-extension key with no disk dist.
 * @evidence contracts/testing.md#independent-expectations The authored include configuration selects all three sources even though only helper is imported; source-only mode preserves TypeScript content and excludes JavaScript, declarations and maps.
 * @evidence contracts/testing.md#distinguishing-cases Imported value source plus unreferenced interface root and nested path distinguish project inclusion from dependency-only walking; singleton transform is covered separately.
 * @evidence contracts/testing.md#execution-ownership The matching TestExecutor feature executes actual native source-map transport, not a fabricated source map decoder.
 * @evidence contracts/e2e.md#necessary-boundary Real project loading must enumerate included roots and return their TypeScript through the API without entering emit; direct dictionary filtering cannot prove compiler membership.
 * @evidence contracts/e2e.md#shared-execution One no-plugin transform returns all three sources and supplies every forbidden-key/no-dist check, sharing package build and tsgo resolution.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The registered fresh project owns its three files and include config; initial dist absence makes publication observable. Synchronous child completion precedes observation and suite cleanup removes the root.
 * @evidence contracts/e2e.md#preserved-coverage All three source snippets, all-key emitted-family exclusions, success and no-dist assertions remain. Exact full-source equality and library-source enumeration are not claimed.
 */
export const test_ttsccompiler_transform_returns_every_included_typescript_source_file =
  () => {
    const root = createProject({
      files: {
        "src/helpers.ts":
          "export const helper = (value: string): string => value.toUpperCase();\n",
        "src/nested/model.ts": "export interface Model { value: string }\n",
      },
      source:
        'import { helper } from "./helpers";\nconst message: string = helper("api-ok");\nconsole.log(message);\n',
    });
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      plugins: false,
    });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.match(
      expectRecordValue(result.typescript, "src/main.ts"),
      /helper\("api-ok"\)/,
    );
    assert.match(
      expectRecordValue(result.typescript, "src/helpers.ts"),
      /toUpperCase/,
    );
    assert.match(
      expectRecordValue(result.typescript, "src/nested/model.ts"),
      /interface Model/,
    );
    for (const key of Object.keys(result.typescript)) {
      assert.equal(key.startsWith("dist/"), false);
      assert.equal(/\.(?:js|cjs|mjs|d\.ts|map)$/.test(key), false);
    }
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
  };

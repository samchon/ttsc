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
 * This ttsc API scenario is owned by a tests package instead of the production
 * package manifest, so package.json stays focused on build and publish
 * contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
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

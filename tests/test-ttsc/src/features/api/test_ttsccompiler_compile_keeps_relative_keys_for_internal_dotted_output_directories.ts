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
 * Verifies TtscCompiler.compile keeps relative keys for internal dotted output
 * directories.
 *
 * When `outDir` starts with `..` (e.g. `..dist`) the Go binary can emit the
 * output paths as absolute strings because the anchor differs from the project
 * root. Pins the normalization pass that converts these back to relative keys
 * so API consumers always receive a uniform `Record<string, string>` map
 * regardless of how the tsconfig arranges its directories.
 *
 * 1. Create a project with `outDir: "..dist"` (dotted-prefix directory).
 * 2. Call `compile()` via the programmatic API.
 * 3. Assert output keys are relative strings and no key is an absolute path.
 */
export const test_ttsccompiler_compile_keeps_relative_keys_for_internal_dotted_output_directories =
  () => {
    const root = createProject({
      outDir: "..dist",
    });
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      plugins: false,
    });

    const result = compiler.compile();

    assert.equal(result.type, "success");
    assert.match(expectRecordValue(result.output, "..dist/main.js"), /api-ok/);
    assert.equal(
      Object.keys(result.output).some((key) => path.isAbsolute(key)),
      false,
    );
    assert.equal(fs.existsSync(path.join(root, "..dist")), false);
  };

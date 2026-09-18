import {
  TtscCompiler,
  assert,
  createProject,
  tsgo,
  writeMalformedAdvisoryTransformPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform forwards the envelope's `sourceMaps` entries
 * that are well-formed maps of transformed files, and drops the rest
 * (samchon/ttsc#1392).
 *
 * A consumer hands a map to a bundler, which trusts it to describe the text it
 * holds. A malformed map, or one for a file the envelope has no text for,
 * cannot describe any output and must not reach a consumer. Dropping it
 * degrades that file to having no map, exactly as a host that writes none.
 *
 * 1. Create a project whose fixture plugin prints one valid map, one map with the
 *    wrong version, and one map for a file without text.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert success and that only the valid map survives.
 */
export const test_ttsccompiler_transform_keeps_only_well_formed_source_maps =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeMalformedAdvisoryTransformPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.deepEqual(result.sourceMaps, {
      "src/main.ts": {
        file: "main.ts",
        mappings: "AAAA",
        names: [],
        sources: ["main.ts"],
        sourcesContent: ["export const value = 1\n"],
        version: 3,
      },
    });
  };

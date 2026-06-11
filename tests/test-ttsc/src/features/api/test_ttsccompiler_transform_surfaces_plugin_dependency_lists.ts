import {
  TtscCompiler,
  assert,
  createProject,
  tsgo,
  writeCompilerPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform surfaces the plugin-reported dependency
 * lists.
 *
 * Implements the protocol slot from samchon/ttsc#214: a transform native source
 * may report, per transformed file, the source files it consulted
 * (`dependencies` in the stdout envelope), and the programmatic API must pass
 * the record through verbatim so bundler adapters can register watch files for
 * type-only inputs. If the host dropped the field, HMR invalidation for
 * generated code could never work regardless of what plugins report.
 *
 * 1. Create a project whose fixture plugin reports `{"src/main.ts":
 *    ["src/consulted.d.ts"]}` alongside its output.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the success result carries the dependency record unchanged.
 */
export const test_ttsccompiler_transform_surfaces_plugin_dependency_lists =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeCompilerPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.deepEqual(result.dependencies, {
      "src/main.ts": ["src/consulted.d.ts"],
    });
  };

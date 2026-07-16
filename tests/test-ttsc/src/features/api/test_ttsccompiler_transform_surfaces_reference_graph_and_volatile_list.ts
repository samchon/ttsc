import {
  TtscCompiler,
  assert,
  createProject,
  tsgo,
  writeCompilerPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform surfaces the envelope's reference graph and
 * volatile list.
 *
 * Implements the consumer half of samchon/ttsc#716: a transform host stamps a
 * `graph` section (direct resolved reference edges, global-scope files,
 * tsconfig chain) and may declare non-hermetic outputs through `volatile`; the
 * programmatic API must pass both through so bundler adapters can derive watch
 * inputs and bypass caching. A host that dropped either field would make sound
 * cache invalidation impossible regardless of what plugins emit.
 *
 * 1. Create a project whose fixture plugin stamps a graph (`src/main.ts ->
 *    src/mytype.ts`, ambient global, tsconfig chain) and a volatile list
 *    alongside its output.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the success result carries both fields unchanged.
 */
export const test_ttsccompiler_transform_surfaces_reference_graph_and_volatile_list =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeCompilerPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.deepEqual(result.graph, {
      configs: ["tsconfig.json"],
      edges: { "src/main.ts": ["src/mytype.ts"] },
      globals: ["src/ambient.d.ts"],
    });
    assert.deepEqual(result.volatile, ["src/volatile.ts"]);
  };

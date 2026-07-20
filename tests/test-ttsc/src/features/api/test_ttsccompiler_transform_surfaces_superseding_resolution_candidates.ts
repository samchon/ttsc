import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeCompilerPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform surfaces a populated reference-graph
 * candidate map.
 *
 * The negative half of this contract is pinned by
 * `test_ttsccompiler_transform_surfaces_reference_graph_and_volatile_list`,
 * which asserts that a host reporting no superseding candidate produces no
 * `candidates` key at all. Without this positive twin, `parseReferenceGraph`
 * could drop or mangle every candidate a host does report and both the wire
 * omission and the exact-shape assertion would still pass.
 *
 * 1. Create a project whose fixture plugin echoes a candidate map alongside the
 *    graph it stamps.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the success result carries the candidate map unchanged, keyed by
 *    importing file and ordered as the host reported it.
 */
export const test_ttsccompiler_transform_surfaces_superseding_resolution_candidates =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeCompilerPlugin(root);
    fs.writeFileSync(
      path.join(root, "graph-candidates.json"),
      JSON.stringify({
        "src/main.ts": ["src/mytype.ts", "src/mytype.tsx"],
      }),
      "utf8",
    );
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.deepEqual(result.graph, {
      candidates: { "src/main.ts": ["src/mytype.ts", "src/mytype.tsx"] },
      configs: ["tsconfig.json"],
      edges: { "src/main.ts": ["src/mytype.ts"] },
      globals: ["src/ambient.d.ts"],
    });
  };

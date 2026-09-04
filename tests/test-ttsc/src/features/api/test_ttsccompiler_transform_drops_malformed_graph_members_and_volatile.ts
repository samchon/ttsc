import {
  TtscCompiler,
  assert,
  createProject,
  tsgo,
  writeMalformedAdvisoryTransformPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform tolerates malformed `graph` and `volatile`
 * envelope fields: invalid members are dropped, well-formed adjacency keys and
 * proof-failure reasons survive, and the transform itself never fails.
 *
 * The graph and volatile fields are advisory invalidation metadata with the
 * same tolerance contract as `dependencies` (samchon/ttsc#716): a buggy plugin
 * envelope must degrade to fewer watch registrations, not to a failed build.
 * Whole-field validation would also be wrong — one malformed edge must not
 * discard the sound remainder of the graph.
 *
 * 1. Create a project whose fixture plugin prints an envelope mixing valid and
 *    malformed graph members plus an object-shaped volatile field.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert success, the surviving graph members, and no volatile list.
 */
export const test_ttsccompiler_transform_drops_malformed_graph_members_and_volatile =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeMalformedAdvisoryTransformPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.deepEqual(result.graph, {
      configs: ["tsconfig.json"],
      edges: {
        "src/main.ts": ["src/good.d.ts"],
        "src/worse.ts": [],
      },
      globals: [],
      inputHashes: {
        "src/good.d.ts": "a".repeat(64),
        "src/missing.d.ts": null,
      },
      inputObservations: {
        "src/good.d.ts": { fileExists: true },
        "src/missing.d.ts": {
          directoryExists: true,
          fileExists: false,
        },
      },
      inputProofFailures: {
        "src/bad.d.ts": "malformed-observation",
        "src/missing.d.ts": "content-unavailable",
        "src/worse.d.ts": "conflicting-observation",
      },
      inputRealpaths: {
        "src/good.d.ts": null,
        "src/missing.d.ts": null,
      },
    });
    assert.equal(result.volatile, undefined);
  };

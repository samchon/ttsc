import {
  TtscCompiler,
  assert,
  createProject,
  tsgo,
  writeMalformedAdvisoryTransformPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform drops malformed `dependenciesComplete`
 * members while keeping the well-formed ones, without failing the transform.
 *
 * The field carries the same advisory tolerance as `graph` and `volatile`
 * (samchon/ttsc#720), and dropping is safe in exactly one direction: a file
 * that falls out of the list reverts to the sound host-owned bound, so a
 * garbled declaration costs over-invalidation rather than stale output.
 * Rejecting the whole field on one bad member would be wrong for the same
 * reason one malformed edge does not discard the graph.
 *
 * 1. Create a project whose fixture plugin prints a `dependenciesComplete` list
 *    mixing a valid key with a number and an empty string.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert success and that only the valid key survives.
 */
export const test_ttsccompiler_transform_drops_malformed_dependency_completeness_members =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\nconsole.log(value);\n',
    });
    writeMalformedAdvisoryTransformPlugin(root);
    const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.deepEqual(result.dependenciesComplete, ["src/main.ts"]);
  };

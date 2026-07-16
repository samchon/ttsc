import {
  TtscCompiler,
  assert,
  createProject,
  tsgo,
  writeCompilerPlugin,
} from "../../internal/compiler";

/**
 * Verifies TtscCompiler.transform surfaces the envelope's
 * `dependenciesComplete` declaration alongside the dependency list it
 * qualifies.
 *
 * Implements the consumer half of samchon/ttsc#720: the declaration is what
 * lets a bundler adapter narrow a file's invalidation to the plugin's own
 * reported inputs instead of the host-owned reference bound. A host that
 * dropped the field would silently keep every adopting plugin on the coarse
 * baseline, with no error to point at.
 *
 * 1. Create a project whose fixture plugin reports `dependencies` for
 *    `src/main.ts` and declares that list complete.
 * 2. Call `transform()` via the programmatic API.
 * 3. Assert the success result carries both fields unchanged.
 */
export const test_ttsccompiler_transform_surfaces_the_dependency_completeness_declaration =
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
    assert.deepEqual(result.dependenciesComplete, ["src/main.ts"]);
  };

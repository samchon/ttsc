import { TestProject } from "@ttsc/testing";

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
 * Verifies TtscCompiler.transform surfaces the exact files consulted by the
 * JavaScript plugin host before native transformation.
 *
 * Bundler caches need descriptor, manifest, and explicit config freshness for
 * every output, but must not promote arbitrary unclassified project files to
 * universal inputs. A missing explicit config path is state too: its later
 * creation must invalidate the generation.
 *
 * 1. Create a plugin project with a missing explicit config and an unrelated
 *    asset.
 * 2. Transform it through the programmatic API.
 * 3. Assert only config ancestry, manifest, descriptor, and config path surface.
 */
export const test_ttsccompiler_transform_surfaces_exact_host_inputs = () => {
  const root = TestProject.physicalPath(
    createProject({
      plugins: [
        { transform: "./plugin.cjs", configFile: "missing.plugin.config.json" },
      ],
      source: 'export const value = goUpper("plugin");\n',
    }),
  );
  writeCompilerPlugin(root);
  fs.writeFileSync(path.join(root, "notes.md"), "not a host input\n", "utf8");

  const result = new TtscCompiler({ binary: tsgo, cwd: root }).transform();

  assert.equal(result.type, "success");
  assert.deepEqual(result.hostInputs, [
    path.join(root, "missing.plugin.config.json"),
    path.join(root, "package.json"),
    path.join(root, "plugin.cjs"),
    path.join(root, "tsconfig.json"),
  ]);
};

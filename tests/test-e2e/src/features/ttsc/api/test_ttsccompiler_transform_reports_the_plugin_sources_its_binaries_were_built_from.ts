import { TestProject } from "@ttsc/testing";
import {
  pluginSourceState,
  prunesPluginSourceDirectory,
} from "ttsc/plugin-source";

import {
  TtscCompiler,
  assert,
  createProject,
  fs,
  path,
  tsgo,
  writeCompilerPlugin,
  writeBasicProject,
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies a transform's envelope reports the state of every Go source
 * directory its plugin binaries were built from, by the rule the build keyed
 * them on: the sources, and the environment a build there is keyed on
 * (samchon/ttsc#1487, samchon/ttsc#1493).
 *
 * A plugin's binary is keyed on its source and on its build environment, so its
 * output is a function of both, but the envelope carried only the
 * JavaScript-host files around them: a consumer that cached the output, a dev
 * server or a persistent bundler cache, never heard a plugin edited in place,
 * nor one built under another `GOFLAGS`. The envelope now reports
 * `pluginSources`, and `ttsc/plugin-source` exposes the rule, so a consumer can
 * prove the state the output was compiled for.
 *
 * 1. Transform a project whose plugin is Go source in a module of its own, and
 *    assert the envelope names that module's root alone, none of ttsc's own
 *    sources, with the rule's state of the directory now.
 * 2. Write files the build never keys on (below `node_modules` and `.git`, and an
 *    editor backup), and assert the state does not move.
 * 3. Edit the plugin's Go source, and assert the state moves and the next
 *    transform reports the new one.
 * 4. Assert another `GOFLAGS` moves the state, and a transform whose compiler runs
 *    under it reports that state.
 * 5. Transform a project without a plugin, and assert the envelope reports no
 *    plugin source at all.
 *
 * @evidence contracts/testing.md#behavioral-verification Transforms a plugin project, checks source-state publication, ignores pruned/backup writes, then checks source-edit and GOFLAGS invalidation plus absent provenance for a plugin-free project.
 * @evidence contracts/testing.md#independent-expectations Literal source edits, ignored-directory names and distinct GOFLAGS establish expected change/no-change independently. Exact state equality uses the public pluginSourceState helper and therefore cannot detect a hash defect shared by both producer and that helper.
 * @evidence contracts/testing.md#distinguishing-cases The case owns unchanged ignored inputs, changed meaningful Go input, changed build environment and no-plugin absence, retaining both positive and negative provenance transitions.
 * @evidence contracts/testing.md#execution-ownership The named feature calls checkout built TtscCompiler with selected native compiler and private mutable Go module, with actual state-helper observations between transforms. It observes transport provenance, not independently validated build bytes/loaded image or packed installation.
 * @evidence contracts/e2e.md#necessary-boundary Published pluginSources must describe the artifact actually selected after source/environment changes; state-key unit tests alone cannot establish real artifact selection and returned provenance.
 * @evidence contracts/e2e.md#shared-execution First/source-edit/GOFLAGS requests reuse one project and keyed cache while changed Go bytes or flags require distinct keyed states, not inferred builds or artifact images. Standalone no-plugin contrast uses its original second root. Consolidated execution borrows one empty physical API root and holds the successfully observed plugin inputs aside before writing the exact no-plugin project there; all four native requests remain, with no contributor build required by the last input.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The private mutable module remains distinct from the immutable suite producer. Borrowed execution requires an empty root and exact source/config/package. Only successful source/flag publication checks admit moving the plugin inputs outside that root for plugin-free staging. Baseline GOFLAGS differs from the scoped target even under inherited GOENV; exact prior absent/value state is restored in finally. Standalone tracked roots retain original cleanup, borrowed roots stay with the family. Synchronous return does not certify arbitrary descendants or interruption cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All original source-map equality, pruning predicates, ignored-state equality, source/flag inequality, subsequent publication and no-plugin absence checks remain. Shared helper equality is an acknowledged oracle limitation; the two explicit flag literals establish the contrasting environment premise without using that equality as the setup oracle.
 */
export const test_ttsccompiler_transform_reports_the_plugin_sources_its_binaries_were_built_from =
  (prepared?: { root: string; observedRoot: string }) => {
    const previousGoFlags = process.env.GOFLAGS;
    process.env.GOFLAGS = "-tags=ttsc_build_environment_probe_baseline";
    try {
      const root = TestProject.physicalPath(
        prepared?.root ?? createProject({
          plugins: [{ transform: "./plugin.cjs" }],
          source: 'export const value = goUpper("plugin");\n',
        }),
      );
      if (prepared !== undefined) {
        assert.deepEqual(fs.readdirSync(root), [], "borrowed provenance project must be empty");
        writeBasicProject(root, 'export const value = goUpper("plugin");\n', {
          plugins: [{ transform: "./plugin.cjs" }],
        });
        fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ private: true }), "utf8");
      }
      writeCompilerPlugin(root);
      const source = path.resolve(root, "plugin-go");
      const compiler = new TtscCompiler({ binary: tsgo, cwd: root });

      // 1. The module root, with the rule's state.
      const first = compiler.transform();
      assert.equal(first.type, "success");
      if (first.type !== "success") return;
      // The plugin's own module root alone: ttsc's overlays key the binary too,
      // but they change only with ttsc itself.
      assert.deepEqual(first.pluginSources, {
        [source]: pluginSourceState(source),
      });

      // 2. What the build never keys on moves nothing.
      const before = pluginSourceState(source);
      for (const pruned of ["node_modules", ".git"]) {
        assert.equal(prunesPluginSourceDirectory(pruned), true, pruned);
        fs.mkdirSync(path.join(source, pruned), { recursive: true });
        fs.writeFileSync(path.join(source, pruned, "ignored.go"), "package x\n");
      }
      assert.equal(prunesPluginSourceDirectory("internal"), false);
      fs.writeFileSync(path.join(source, "main.go~"), "backup\n");
      assert.equal(pluginSourceState(source), before);

      // 3. An edit moves it, and the next transform reports the new state.
      fs.appendFileSync(path.join(source, "main.go"), "\n// edited\n");
      const after = pluginSourceState(source);
      assert.notEqual(after, before);
      const second = compiler.transform();
      assert.equal(second.type, "success");
      if (second.type !== "success") return;
      assert.equal(second.pluginSources?.[source], after);

      // 4. Another build environment moves it too.
      const env = { GOFLAGS: "-tags=ttsc_build_environment_probe" };
      const tagged = pluginSourceState(source, {
        env: { ...process.env, ...env },
      });
      assert.notEqual(tagged, after, "another explicit GOFLAGS changes the source state");
      const third = new TtscCompiler({
        binary: tsgo,
        cwd: root,
        env,
      }).transform();
      assert.equal(third.type, "success");
      if (third.type !== "success") return;
      assert.equal(third.pluginSources?.[source], tagged);

      // 5. No plugin, no plugin source.
      let plain: string;
      if (prepared === undefined) {
        plain = createProject({ source: "export const value = 1;\n" });
      } else {
        fs.mkdirSync(prepared.observedRoot, { recursive: true });
        for (const name of fs.readdirSync(root))
          fs.renameSync(path.join(root, name), path.join(prepared.observedRoot, name));
        writeBasicProject(root, "export const value = 1;\n");
        fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ private: true }), "utf8");
        plain = root;
      }
      const bare = new TtscCompiler({ binary: tsgo, cwd: plain }).transform();
      assert.equal(bare.type, "success");
      if (bare.type !== "success") return;
      assert.equal(bare.pluginSources, undefined);
    } finally {
      if (previousGoFlags === undefined) delete process.env.GOFLAGS;
      else process.env.GOFLAGS = previousGoFlags;
    }
  };

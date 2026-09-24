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
} from "../../internal/compiler";

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
 */
export const test_ttsccompiler_transform_reports_the_plugin_sources_its_binaries_were_built_from =
  () => {
    const root = createProject({
      plugins: [{ transform: "./plugin.cjs" }],
      source: 'export const value = goUpper("plugin");\n',
    });
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
    assert.notEqual(tagged, after, "another GOFLAGS builds another binary");
    const third = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      env,
    }).transform();
    assert.equal(third.type, "success");
    if (third.type !== "success") return;
    assert.equal(third.pluginSources?.[source], tagged);

    // 5. No plugin, no plugin source.
    const plain = createProject({ source: "export const value = 1;\n" });
    const bare = new TtscCompiler({ binary: tsgo, cwd: plain }).transform();
    assert.equal(bare.type, "success");
    if (bare.type !== "success") return;
    assert.equal(bare.pluginSources, undefined);
  };

import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies a plugin load reports, as the inputs a watch session observes, the
 * directories its plugin builds key their binaries on, before any build runs
 * (samchon/ttsc#1492).
 *
 * A plugin's `source` may name a package anywhere below its Go module, and the
 * build copies and keys the whole module, every contributor's source, and every
 * linked plugin's package. `ttsc --watch` was handed each plugin's `source` and
 * its contributors' instead, so an edit to a sibling package of the module, or
 * to the module's own `go.mod`, rebuilt the binary on the next run and started
 * none. The load now reports exactly the directories it then reports as
 * `pluginSources`, resolved before the builds, so a build that fails is
 * observed too and its repair is heard.
 *
 * 1. Load a project with an executable plugin whose source is a subpackage of its
 *    module, a contributor, and a linked plugin in another module, and assert
 *    the watch inputs are the module root, the linked package, and the
 *    contributor, and equal the load's `pluginSources`.
 * 2. Load it again with a build that fails, and assert the same inputs were
 *    reported before the failure.
 */
export const test_loadprojectplugins_reports_the_directories_its_plugin_builds_key_on =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-build-directories-");
    const project = path.join(root, "project");
    const module = path.join(root, "plugin-module");
    const linkedModule = path.join(root, "linked-module");
    const contributor = path.join(root, "contributor");
    write(
      path.join(module, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
    );
    write(path.join(module, "cmd", "plugin", "main.go"), "package main\n");
    write(path.join(module, "internal", "mark", "mark.go"), "package mark\n");
    // The files the fake Go build requires of the module it compiles.
    for (const relative of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      write(path.join(module, relative), "package generated\n");
    }
    write(path.join(module, "node_modules", "x", "index.js"), "\n");
    write(
      path.join(linkedModule, "go.mod"),
      "module example.com/linked\n\ngo 1.26\n",
    );
    write(path.join(linkedModule, "rules", "rules.go"), "package rules\n");
    write(path.join(contributor, "extra.go"), "package extra\n");
    write(
      path.join(project, "executable.cjs"),
      `module.exports = () => (${JSON.stringify({
        contributors: [{ name: "extra", source: contributor }],
        name: "executable",
        source: path.join(module, "cmd", "plugin"),
      })});\n`,
    );
    write(
      path.join(project, "linked.cjs"),
      `module.exports = () => (${JSON.stringify({
        name: "linked",
        source: path.join(linkedModule, "rules"),
      })});\n`,
    );
    write(
      path.join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          plugins: [
            { transform: "./executable.cjs" },
            { transform: "./linked.cjs" },
          ],
        },
      }),
    );
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const env = {
      ...process.env,
      TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
      TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
    };
    const expected = [
      fs.realpathSync(module),
      fs.realpathSync(path.join(linkedModule, "rules")),
      fs.realpathSync(contributor),
    ].sort();
    const load = (
      cache: string,
      extra: NodeJS.ProcessEnv,
      reported: (inputs: readonly string[]) => void,
    ) =>
      loadProjectPlugins({
        binary: "",
        cacheDir: path.join(root, cache),
        cwd: project,
        env: { ...env, ...extra },
        onWatchInputs: reported,
        tsconfig: path.join(project, "tsconfig.json"),
      });

    // 1. What the builds key on, and nothing else.
    let inputs: readonly string[] | undefined;
    const loaded = load("cache", {}, (reported) => {
      inputs = reported;
    });
    assert.deepEqual(inputs, expected);
    assert.deepEqual(Object.keys(loaded.pluginSources).sort(), expected);

    // 2. Reported before a build that fails, in a cache that holds no binary.
    let failed: readonly string[] | undefined;
    assert.throws(
      () =>
        load("cold-cache", { FAKE_GO_BUILD_EXIT_CODE: "1" }, (reported) => {
          failed = reported;
        }),
      /build failed as directed/,
    );
    assert.deepEqual(failed, expected);
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

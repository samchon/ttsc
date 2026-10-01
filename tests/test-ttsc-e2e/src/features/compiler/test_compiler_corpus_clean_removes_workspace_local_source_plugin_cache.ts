import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "clean removes workspace-local source plugin cache",
  root: () =>
    commonJsProject({
      "pnpm-workspace.yaml": "packages: []\n",
      "src/main.ts": `export const value = "clean-local-cache";\n`,
    }),
  run(root: string) {
    const pluginCache = path.join(
      root,
      "node_modules",
      ".cache",
      "ttsc",
      "plugins",
    );
    fs.mkdirSync(path.join(pluginCache, "a"), { recursive: true });
    fs.writeFileSync(path.join(pluginCache, "a", "plugin"), "binary", "utf8");

    // Isolate the machine cache locations so clean's pre-0.17 legacy-global
    // cache reclamation cannot touch the real developer cache when run locally.
    const home = path.join(root, "cache-home");
    const result = spawn(ttscBin, ["clean", "--cwd", root], {
      cwd: root,
      env: {
        HOME: home,
        USERPROFILE: home,
        XDG_CACHE_HOME: path.join(home, ".cache"),
        LOCALAPPDATA: path.join(home, "AppData", "Local"),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    // clean removes ttsc-owned subdirectories (plugins/, go-build/), not the
    // parent cache root, which may be shared with other tools.
    assert.match(
      result.stdout,
      /removed node_modules[/\\]\.cache[/\\]ttsc[/\\]plugins/,
    );
    assert.equal(fs.existsSync(pluginCache), false);
  },
};

/**
 * Verifies compiler corpus: clean removes workspace-local source plugin cache.
 *
 * The default source-plugin cache lives inside the workspace at
 * `node_modules/.cache/ttsc`. `ttsc clean` must remove that active default
 * plugin-binary cache without
 * needing a `--cache-dir`/`TTSC_CACHE_DIR` override.
 *
 * 1. Materialize a project and seed its workspace-local plugin cache.
 * 2. Run `ttsc clean`.
 * 3. Assert the workspace-local cache is reported removed and is gone.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs ttsc clean without a cache override after planting the default workspace plugins tree; asserts zero exit, its removal report and disappearance of that plugins leaf.
 * @evidence contracts/testing.md#independent-expectations The default workspace plugin cache is a cleanup target without opt-in. Literal seeded path and command-produced absence establish default selection independently of cache-root code.
 * @evidence contracts/testing.md#distinguishing-cases Owns default active plugin cleanup with isolated machine-home locations. Explicit/environment/legacy paths have other owners; this fixture does not seed or assert the nested Go build cache.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_clean_removes_workspace_local_source_plugin_cache is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The launcher must select the default project cache and delete its plugin leaf through the actual command, rather than merely calculating its path.
 * @evidence contracts/e2e.md#shared-execution One cleanup process verifies default selection/report/deletion together. Fake binary bytes need no native compilation and built CLI preparation is shared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity An explicit pnpm workspace marker pins default-cache discovery to this fixture despite ambient ancestor installations; the active cache and child-only machine-home overrides live under that unique project. Synchronous execution ends before assertions; TestProject removes any remaining parent directories at worker exit.
 * @evidence contracts/e2e.md#preserved-coverage Exit, plugin removal report and plugin-leaf absence remain in project.run. This entry has no Go-object assertion and no such coverage is claimed.
 */
export const test_compiler_corpus_clean_removes_workspace_local_source_plugin_cache =
  (): void => {
    const root = project.root();
    project.run(root);
  };

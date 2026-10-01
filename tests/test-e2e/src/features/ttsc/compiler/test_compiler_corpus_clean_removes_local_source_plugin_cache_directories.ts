import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";

const project = {
  name: "clean removes local source plugin cache directories",
  root: () =>
    commonJsProject(FixtureFiles.read("ttsc/compiler_corpus_clean_removes_local_source_plugin_cache_directories/inputs-1")),
  run(root: string) {
    const override = path.join(root, "override-cache");
    for (const target of [
      path.join(root, "node_modules", ".ttsc", "plugins", "a"),
      path.join(root, ".ttsc", "plugins", "b"),
      path.join(override, "plugins", "c"),
    ]) {
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, "plugin"), "binary", "utf8");
    }

    // Isolate the machine cache locations so clean's pre-0.17 legacy-global
    // cache reclamation cannot touch the real developer cache when run locally.
    const home = path.join(root, "cache-home");
    const result = spawn(ttscBin, ["clean", "--cwd", root], {
      cwd: root,
      env: {
        TTSC_CACHE_DIR: override,
        HOME: home,
        USERPROFILE: home,
        XDG_CACHE_HOME: path.join(home, ".cache"),
        LOCALAPPDATA: path.join(home, "AppData", "Local"),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /removed node_modules[/\\]\.ttsc/);
    assert.match(result.stdout, /removed \.ttsc/);
    assert.equal(
      fs.existsSync(path.join(root, "node_modules", ".ttsc")),
      false,
    );
    assert.equal(fs.existsSync(path.join(root, ".ttsc")), false);
    assert.equal(fs.existsSync(path.join(override, "plugins")), false);
  },
};

/**
 * Verifies compiler corpus: clean removes all local source-plugin cache
 * directories at once.
 *
 * A project can accumulate plugin binaries in up to three locations:
 * `node_modules/.ttsc/`, `.ttsc/`, and a custom `TTSC_CACHE_DIR` path. Running
 * `ttsc clean` must sweep all three so a corrupted or stale cache in any
 * location is fully cleared by a single command.
 *
 * 1. Seed fake plugin binaries in all three local cache locations.
 * 2. Run `ttsc clean` with `TTSC_CACHE_DIR` pointing at the custom cache.
 * 3. Assert all three cache roots are removed and stdout reports each removal.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs ttsc clean with TTSC_CACHE_DIR override after seeding node_modules/.ttsc, .ttsc and override/plugins; checks zero exit, both legacy removal reports and absence of all three owned plugin-cache populations.
 * @evidence contracts/testing.md#independent-expectations Cleanup reclaims supported legacy locations together with the selected active plugin cache. Authored old/new roots and post-command absence supply expectations without comparing committed layouts.
 * @evidence contracts/testing.md#distinguishing-cases Owns two distinct legacy roots plus an environment-selected active root in one command. Other entries cover explicit and default roots and rejection of project-root deletion.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_clean_removes_local_source_plugin_cache_directories is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The real command must assemble legacy and environment-selected targets then delete them; direct target calculation does not prove the filesystem sweep or launcher environment.
 * @evidence contracts/e2e.md#shared-execution One process and one project batch the three locations. Fake plugin files avoid native builds, while the built CLI is shared across corpus entries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TTSC_CACHE_DIR and machine cache-home variables point only to owned subtrees in the child environment. Synchronous exit precedes inspection, and TestProject removes remaining project/cache-home state at worker exit.
 * @evidence contracts/e2e.md#preserved-coverage Both legacy report assertions and all three disappearance checks remain executable in project.run under this export. The override has no separate stdout assertion, so the acknowledgment does not claim one.
 */
export const test_compiler_corpus_clean_removes_local_source_plugin_cache_directories =
  (): void => {
    const root = project.root();
    project.run(root);
  };

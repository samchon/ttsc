import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: prepare loads TypeScript lint config without PATH
 * ttsx.
 *
 * `ttsc prepare` loads plugin factories before any native sidecar spawn. The
 * `@ttsc/lint` factory evaluates `lint.config.ts` through `ttsx`; when callers
 * invoke `node_modules/.bin/ttsc` directly, PATH may not contain
 * `node_modules/.bin`, so prepare must provide the bundled ttsx launcher.
 *
 * 1. Create an @ttsc/lint project with a TypeScript lint config.
 * 2. Run `ttsc prepare` with TTSC_TTSX_BINARY removed from the environment.
 * 3. Assert prepare succeeds and does not report a missing `ttsx` executable.
 */
export const test_plugin_corpus_prepare_loads_typescript_lint_config_without_path_ttsx =
  () => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { "@ttsc/lint": "*" } }),
    );
    fs.writeFileSync(
      path.join(root, "lint.config.ts"),
      `import type { ITtscLintConfig } from "@ttsc/lint";

export default {
  rules: {
    "no-var": "error",
  },
} satisfies ITtscLintConfig;
`,
    );

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: goPath(),
      TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-lint-prepare-"),
    };
    delete env.TTSC_TTSX_BINARY;
    delete env.TTSC_NODE_BINARY;

    const result = spawn(ttscBin, ["prepare", "--cwd", root], {
      cwd: root,
      env,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ttsc: prepared /);
    assert.doesNotMatch(result.stderr, /spawn ttsx ENOENT/);
  };

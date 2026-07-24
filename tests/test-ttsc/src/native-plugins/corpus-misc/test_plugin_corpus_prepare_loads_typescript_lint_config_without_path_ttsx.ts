import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
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
 * 2. Import its severity through an exports package whose inactive condition
 *    throws, exercising the descriptor extractor's package-topology mirror.
 * 3. Run `ttsc prepare` with TTSC_TTSX_BINARY removed from the environment.
 * 4. Assert prepare succeeds and does not report a missing `ttsx` executable.
 */
export const test_plugin_corpus_prepare_loads_typescript_lint_config_without_path_ttsx =
  () => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { "@ttsc/lint": "*" } }),
    );
    const selectionPackage = path.join(
      root,
      "node_modules",
      "descriptor-selection",
    );
    fs.mkdirSync(path.join(selectionPackage, "active"), { recursive: true });
    fs.mkdirSync(path.join(selectionPackage, "inactive"), { recursive: true });
    fs.writeFileSync(
      path.join(selectionPackage, "package.json"),
      JSON.stringify({
        exports: {
          ".": {
            import: "./active/index.mjs",
            default: "./inactive/index.mjs",
          },
        },
        type: "module",
      }),
    );
    fs.writeFileSync(
      path.join(selectionPackage, "active", "index.mjs"),
      `export default "error";\n`,
    );
    fs.writeFileSync(
      path.join(selectionPackage, "inactive", "index.mjs"),
      `throw new Error("inactive exports condition loaded");\n`,
    );
    fs.writeFileSync(
      path.join(root, "lint.config.ts"),
      `import type { ITtscLintConfig } from "@ttsc/lint";
import severity from "descriptor-selection";

export default {
  rules: {
    "no-var": severity,
  },
} satisfies ITtscLintConfig;
`,
    );

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
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

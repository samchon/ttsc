import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../../internal/plugin-corpus";

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
 * 2. Import its severity through an extensionless local TypeScript helper and an
 *    exports package whose inactive condition throws, exercising both local
 *    candidate capture and the descriptor extractor's package-topology mirror.
 * 3. Run `ttsc prepare` with TTSC_TTSX_BINARY removed from the environment.
 * 4. Assert prepare succeeds and does not report a missing `ttsx` executable.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc prepare loads the TypeScript lint config and succeeds without spawn ttsx ENOENT.
 * @evidence contracts/testing.md#independent-expectations The active package export returns error while the inactive export throws; successful prepare proves the active module can be evaluated.
 * @evidence contracts/testing.md#distinguishing-cases No TTSC_TTSX_BINARY or TTSC_NODE_BINARY override is supplied; extensionless local and conditional package imports force actual descriptor evaluation.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_prepare_loads_typescript_lint_config_without_path_ttsx entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The prepare CLI invokes the linked lint descriptor, which loads TypeScript through the bundled ttsx evaluator with extensionless and conditional package imports. Successful real child evaluation proves launcher-provided interpreter discovery when its explicit override is absent.
 * @evidence contracts/e2e.md#shared-execution The suite reuses built workspace packages and the shared content-addressed producer cache when this case selects it. Separate launcher invocations carry this case's differing arguments or selected runtime entry; a case-local cold cache is retained when preparation or failure is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc prepare loads the TypeScript lint config and succeeds without spawn ttsx ENOENT. These assertions stay in test_plugin_corpus_prepare_loads_typescript_lint_config_without_path_ttsx with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_prepare_loads_typescript_lint_config_without_path_ttsx =
  () => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        devDependencies: { "@ttsc/lint": "*" },
        type: "module",
      }),
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
    // The shared fixture starts with a JSON config. This scenario replaces it
    // with TypeScript; retaining both would be the ambiguity native discovery
    // deliberately rejects before evaluating either file.
    fs.rmSync(path.join(root, "lint.config.json"));
    fs.writeFileSync(
      path.join(root, "severity.ts"),
      `export { default } from "descriptor-selection";\n`,
    );
    fs.writeFileSync(
      path.join(root, "lint.config.ts"),
      `import type { ITtscLintConfig } from "@ttsc/lint";
import severity from "./severity";

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

import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies one-shot lint failures reuse a complete Program report.
 *
 * The lint host checks referenced sources. A standalone recovery check reads
 * their declaration outputs and reports TS6305 when those outputs are missing.
 * An early lint failure still needs that recovery check.
 *
 * 1. Add an unbuilt reference and an incompatible assignment to the fixture.
 * 2. Check that the loaded lint Program reports both kinds of diagnostics.
 * 3. Break the lint config and check that the standalone diagnostic returns.
 *
 * @evidence contracts/testing.md#behavioral-verification The CLI reports no-var and one TS2322 from a loaded lint Program without TS6305. When that same host cannot load its config, recovery reports TS6305.
 * @evidence contracts/testing.md#independent-expectations A string assigned to number requires TS2322. The imported composite reference has no declaration output, so the standalone compiler lane emits TS6305; the unbuilt output supplies a witness even when identical diagnostics would be deduplicated.
 * @evidence contracts/testing.md#distinguishing-cases The same source/config selection tests a complete native Program failure and a lint-config failure before Program loading. Both retain the nonzero command status and neither leaks a receipt.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named corpus-ttsc export in the generic E2E population; the public CLI uses the workspace-linked native lint producer. Body presence is not execution or a packed installation/Linux-only selection claim.
 * @evidence contracts/e2e.md#necessary-boundary The post-plugin failure guard must recognize diagnostics already emitted by the actual producer; isolated renderer or rule units do not prove this handoff.
 * @evidence contracts/e2e.md#shared-execution Both calls share the tracked consumer, reference, unchanged lint producer and suite-owned plugin cache. The diagnostic contrast establishes the recovery decision without measuring time or counting processes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked consumer owns the reference, source edits and config changes. Error, signal and numeric nonzero status distinguish a product failure from failed launch.
 * @evidence contracts/e2e.md#preserved-coverage The original failed exit, no-var report and single TS2322 remain, with a contrast for the independent recovery path.
 */
export function test_plugin_corpus_ttsc_lint_failure_does_not_duplicate_typescript_diagnostics(): void {
  const root = setupLintProject("lint-violations");
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.references = [{ path: "./reference" }];
  fs.writeFileSync(tsconfig, JSON.stringify(config));
  fs.mkdirSync(path.join(root, "reference", "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "reference", "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        composite: true,
        target: "ES2022",
        module: "commonjs",
        rootDir: "src",
        outDir: "dist",
      },
      include: ["src"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "reference", "src", "value.ts"),
    'export const value: string = "type-error";\n',
  );
  fs.appendFileSync(
    path.join(root, "src", "main.ts"),
    '\nimport { value } from "../reference/src/value";\nconst wrong: number = value;\nvoid wrong;\n',
    "utf8",
  );
  const check = () => {
    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 2, result.stderr);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /ttsc:diagnostics-complete:/,
    );
    return result.stderr;
  };
  const reported = check();
  assert.match(reported, /\[no-var\]/);
  assert.equal(reported.match(/TS2322/g)?.length, 1, reported);
  assert.doesNotMatch(reported, /TS6305/);

  fs.writeFileSync(path.join(root, "lint.config.json"), "{");
  const recovered = check();
  assert.match(recovered, /lint\.config\.json/);
  assert.match(recovered, /TS6305/);
}

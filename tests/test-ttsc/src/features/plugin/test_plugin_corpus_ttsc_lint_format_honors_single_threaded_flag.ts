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
 * Verifies plugin corpus: `ttsc format --singleThreaded` reaches the lint
 * sidecar.
 *
 * The benchmark cell `typeorm:ttsc-lint:format:single` collapsed to within 1%
 * of the multi-threaded cell because `runBuild.ts` had stopped forwarding
 * `--singleThreaded` / `--checkers` to native plugin hosts (ad3443a). For the
 * lint sidecar specifically that meant the threading knob was silently dropped:
 * the engine pool ran parallel and the parser pool ran parallel regardless of
 * the user flag, so MT and ST became the same run. The fix narrows the ad3443a
 * guard so the ttsc-owned `@ttsc/lint` host gets both flags forwarded (other
 * check-stage hosts still don't, preserving the strict-host regression in
 * `test_plugin_corpus_single_threaded_flag_does_not_break_a_native_plugin_build`).
 * This case pins that forwarding: an explicit format violation must still be
 * fixed when the launcher is asked to run single-threaded, proving the flag
 * survives the launcher boundary and the sidecar accepts it without exiting.
 *
 * 1. Materialize a `@ttsc/lint` project whose source contains a `'single'` string
 *    literal and a `formatQuotes: error` rule.
 * 2. Run `ttsc format -p tsconfig.json --singleThreaded`.
 * 3. Assert zero exit and the literal is rewritten to use double quotes.
 */
export const test_plugin_corpus_ttsc_lint_format_honors_single_threaded_flag =
  () => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          noEmit: true,
          rootDir: "src",
          plugins: [{ transform: "@ttsc/lint" }],
        },
        include: ["src"],
      }),
    );
    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify({ rules: { formatQuotes: "error" } }),
    );
    const sourcePath = path.join(root, "src", "main.ts");
    fs.writeFileSync(sourcePath, `export const value = 'single';\n`);

    const cacheDir = TestProject.tmpdir("ttsc-lint-format-singlethread-");
    const result = spawn(
      ttscBin,
      [
        "format",
        "--cwd",
        root,
        "-p",
        path.join(root, "tsconfig.json"),
        "--singleThreaded",
      ],
      {
        cwd: root,
        env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      fs.readFileSync(sourcePath, "utf8"),
      `export const value = "single";\n`,
    );
  };

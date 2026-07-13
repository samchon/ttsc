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
 * Verifies the package auto-discovery path carries switch-exhaustiveness-check
 * scalar defaults and all four options without a tsconfig plugin entry.
 *
 * 1. Run issue #416's five default-behavior violations through the real CLI.
 * 2. Rewrite the config with every option set away from its default.
 * 3. Assert each independent default/comment policy produces the expected
 *    diagnostics while clean controls stay silent.
 */
export const test_plugin_corpus_package_ttsc_plugin_switch_exhaustiveness_defaults_and_options =
  () => {
    const root = setupLintProject("lint-violations");
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { "@ttsc/lint": "*" } }),
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          rootDir: "src",
        },
        include: ["src"],
      }),
    );

    const run = () =>
      spawn(ttscBin, ["--cwd", root, "--noEmit"], {
        cwd: root,
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      });
    const clean = (stderr: string) =>
      stderr.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
    const findingCount = (stderr: string) =>
      clean(stderr).match(/\[typescript\/switch-exhaustiveness-check\]/g)
        ?.length ?? 0;

    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify({
        rules: { "typescript/switch-exhaustiveness-check": "error" },
      }),
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `type Choice = "alpha" | "beta";
declare const withDefault: Choice;
switch (withDefault) { case "alpha": break; default: break; }

declare const withoutDefault: Choice;
switch (withoutDefault) { case "alpha": break; }

declare const singleton: "only";
switch (singleton) {}

declare const first: unique symbol;
declare const second: unique symbol;
declare const symbolValue: typeof first | typeof second;
switch (symbolValue) { case first: break; }

declare const maybeText: string | undefined;
switch (maybeText) { case "known": break; }

declare const complete: Choice;
switch (complete) { case "alpha": break; case "beta": break; default: break; }
`,
    );
    let result = run();
    assert.notEqual(result.status, 0, "expected scalar-default violations");
    assert.equal(findingCount(result.stderr), 5, clean(result.stderr));
    assert.equal(
      clean(result.stderr).match(/Cases not matched: "beta"/g)?.length,
      2,
      clean(result.stderr),
    );
    assert.match(clean(result.stderr), /Cases not matched: "only"/);
    assert.match(clean(result.stderr), /Cases not matched: typeof second/);
    assert.match(clean(result.stderr), /Cases not matched: undefined/);
    const defaultOutput = clean(result.stderr);
    assert.match(defaultOutput, /switch \(withDefault\)/);
    assert.match(defaultOutput, /switch \(withoutDefault\)/);
    assert.match(defaultOutput, /switch \(singleton\)/);
    assert.match(defaultOutput, /switch \(symbolValue\)/);
    assert.match(defaultOutput, /switch \(maybeText\)/);
    assert.doesNotMatch(defaultOutput, /switch \(complete\)/);

    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify({
        rules: {
          "typescript/switch-exhaustiveness-check": [
            "error",
            {
              allowDefaultCaseForExhaustiveSwitch: false,
              considerDefaultExhaustiveForUnions: true,
              defaultCaseCommentPattern: "^skip\\s+default$",
              requireDefaultForNonUnion: true,
            },
          ],
        },
      }),
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      `type Choice = "alpha" | "beta";
declare const hiddenByDefault: Choice;
switch (hiddenByDefault) { case "alpha": break; default: break; }

declare const redundantDefault: Choice;
switch (redundantDefault) { case "alpha": break; case "beta": break; default: break; }

declare const openWithoutDefault: string;
switch (openWithoutDefault) { case "known": break; }

declare const customComment: string;
switch (customComment) { case "known": break; /* skip   default */ }

declare const oldDefaultComment: string;
switch (oldDefaultComment) { case "known": break; /* no default */ }
`,
    );
    result = run();
    assert.notEqual(result.status, 0, "expected non-default option violations");
    assert.equal(findingCount(result.stderr), 3, clean(result.stderr));
    assert.equal(
      clean(result.stderr).match(/Cases not matched: default/g)?.length,
      2,
      clean(result.stderr),
    );
    assert.equal(
      clean(result.stderr).match(/default case is unnecessary/g)?.length,
      1,
      clean(result.stderr),
    );
    const optionOutput = clean(result.stderr);
    assert.match(optionOutput, /switch \(redundantDefault\)/);
    assert.match(optionOutput, /switch \(openWithoutDefault\)/);
    assert.match(optionOutput, /switch \(oldDefaultComment\)/);
    assert.doesNotMatch(optionOutput, /switch \(hiddenByDefault\)/);
    assert.doesNotMatch(optionOutput, /switch \(customComment\)/);
  };

import assert from "node:assert/strict";

import { AUTOMATIC_RULE_GLOBS } from "../../internal/adapter-next/AUTOMATIC_RULE_GLOBS";
import type { INextLikeConfig } from "../../internal/adapter-next/INextLikeConfig";
import { LOADER } from "../../internal/adapter-next/LOADER";
import { LOADER_FORMS } from "../../internal/adapter-next/LOADER_FORMS";
import { loadNextModule } from "../../internal/adapter-next/loadNextModule";

const EXTENSION_NAMES = AUTOMATIC_RULE_GLOBS.map((glob) => glob.slice(2));

const REQUIRED_EXTENSION_GROUPS = [
  ["ts", "tsx"],
  ["ts", "mts"],
  ["ts", "cts"],
  ["tsx", "mts"],
  ["tsx", "cts"],
  ["mts", "cts"],
  ["ts", "tsx", "mts"],
  ["ts", "tsx", "cts"],
  ["ts", "mts", "cts"],
  ["tsx", "mts", "cts"],
  ["ts", "tsx", "mts", "cts"],
] as const;

/**
 * Spellings the exact guard must refuse because no real build measured them.
 *
 * `{src/,}*.ts` is the measured one: Turbopack matches nothing with it, so
 * recognising it left every module without a rule (samchon/ttsc#1319). The rest
 * include whitespace around otherwise measured keys, which cannot be assumed
 * equivalent unless Turbopack itself proves that normalization. The other
 * shapes are unmeasured, which is the same reason — nothing has shown that
 * Turbopack expands a single-alternative group, a leading empty alternative, or
 * two groups in one glob, so claiming they cover the project would be a guess
 * in the direction that fails silently.
 */
const REFUSED_GLOBS = [
  " *.ts",
  "*.ts ",
  "{src/,}*.ts",
  "{src,lib}/*.{ts,tsx}",
  "{src/,lib/}*.ts",
  "*.{ts}",
  "{,**/}*.ts",
  "{**/,}*.{ts,tsx}",
  "*.{ts,}",
];

/**
 * Verifies the Next.js wrapper never registers its loader a second time under a
 * glob the caller spelled differently.
 *
 * The dedupe guard read only the rule stored under the exact key the wrapper
 * writes, so a caller who had wired `"*.{ts,tsx}"` by hand, which is a natural
 * way to write two identical rules, kept their rule and received `"*.ts"` and
 * `"*.tsx"` as well. Every TypeScript module then matched two rules and the
 * loader ran twice on it, with the second pass receiving the first pass's
 * output (samchon/ttsc#1314).
 *
 * The wrapper still completes a partial hand wiring, since `"*.ts"` alone
 * leaves `.tsx` unrouted, and still adds its own rules beside a glob carrying
 * somebody else's loader, because that is not this loader running twice.
 * Recognition is an exact measured set rather than a predicate: `{src/,}*.ts`
 * looks project-wide, yet Turbopack matches nothing with it
 * (samchon/ttsc#1319).
 *
 * 1. Assert the measured allowlist covers every single- and multi-extension
 *    spelling it claims, without duplicates.
 * 2. Wrap configs that already route the loader under brace, recursive, partial,
 *    path-scoped, conditional, and foreign-loader globs.
 * 3. Assert the wrapper adds exactly the globs each one leaves unrouted, for every
 *    loader spelling.
 * 4. Assert every unmeasured spelling suppresses nothing.
 */
export async function test_next_adapter_does_not_double_register_across_globs(): Promise<void> {
  const nextModule = await loadNextModule();
  const next = nextModule.default;
  const coverageEntries = nextModule.TURBOPACK_PROJECT_WIDE_GLOB_COVERAGE;
  const coverage = new Map(coverageEntries);
  assert.ok(
    coverageEntries.length > 0,
    "the measured allowlist must not be empty",
  );
  assert.equal(
    coverage.size,
    coverageEntries.length,
    "the measured allowlist must not contain duplicate glob spellings",
  );
  for (const extension of EXTENSION_NAMES) {
    for (const glob of [
      `*.${extension}`,
      `**/*.${extension}`,
      `{**/,}*.${extension}`,
    ]) {
      assert.deepEqual(
        coverage.get(glob),
        [extension],
        `${glob} must cover its complete single-extension family`,
      );
    }
  }
  for (const extensions of REQUIRED_EXTENSION_GROUPS) {
    const suffixes = extensions.join(",");
    const alternatives = extensions
      .map((extension) => `*.${extension}`)
      .join(",");
    for (const glob of [
      `*.{${suffixes}}`,
      `{${alternatives}}`,
      `**/*.{${suffixes}}`,
      `**/{${alternatives}}`,
      `**/**/*.{${suffixes}}`,
    ]) {
      assert.deepEqual(
        coverage.get(glob),
        extensions,
        `${glob} must cover its complete extension combination`,
      );
    }
  }
  const globs = (config: INextLikeConfig): string[] =>
    Object.keys(next(config).turbopack?.rules ?? {});

  assert.deepEqual(
    globs({ turbopack: { rules: { "*.{ts,tsx}": { loaders: [LOADER] } } } }),
    ["*.{ts,tsx}", "*.mts", "*.cts"],
    "a brace list must suppress only the two extensions it actually names",
  );
  assert.deepEqual(
    globs({
      turbopack: {
        rules: {
          "**/*.ts": { loaders: [LOADER] },
          "**/*.tsx": { loaders: [LOADER] },
        },
      },
    }),
    ["**/*.ts", "**/*.tsx", "*.mts", "*.cts"],
    "recursive rules must leave only the missing module-format extensions",
  );

  // A partial hand wiring is still completed: three extensions are unrouted.
  // Both spellings of it, since samchon/ttsc#1314 asks for the recursive one by
  // name and a guard could recognise `*.ts` while missing `**` + `/*.ts`.
  for (const partial of ["*.ts", "**/*.ts"]) {
    assert.deepEqual(
      globs({ turbopack: { rules: { [partial]: { loaders: [LOADER] } } } }),
      [partial, "*.tsx", "*.mts", "*.cts"],
      `${partial} must still gain every glob it is missing`,
    );
  }

  // Somebody else's loader on the same file set is not this loader running
  // twice, so ttsc still has to be wired.
  assert.deepEqual(
    globs({ turbopack: { rules: { "*.{ts,tsx}": { loaders: ["other"] } } } }),
    ["*.{ts,tsx}", ...AUTOMATIC_RULE_GLOBS],
    "another loader's glob must not suppress ttsc's own rules",
  );

  // The direction that matters most, because getting it wrong is
  // samchon/ttsc#1310 again rather than a double transform: a rule scoped to a
  // path covers its own subtree and says nothing about the rest of the
  // project, so the wrapper must still add its own.
  for (const scoped of [
    "src/*.{ts,tsx}",
    "src/**/*.ts",
    "./src/**/*.{ts,tsx}",
    "generated.ts",
    "*.d.ts",
  ]) {
    assert.deepEqual(
      globs({ turbopack: { rules: { [scoped]: { loaders: [LOADER] } } } }),
      [scoped, ...AUTOMATIC_RULE_GLOBS],
      `a rule scoped by ${scoped} must not suppress the project-wide rules`,
    );
  }

  // And the shapes the guard does recognise. Each names every file with the
  // extension, so the wrapper's own rules would be a second registration of a
  // file set the caller already routed. Every one of these is driven through a
  // real Turbopack build by `experimental/test-unplugin`, because whether a
  // glob covers the project is Turbopack's answer and not ours.
  for (const [wide, covered] of coverageEntries) {
    const missing = AUTOMATIC_RULE_GLOBS.filter(
      (glob) => !covered.includes(glob.slice(2)),
    );
    for (const loader of LOADER_FORMS) {
      assert.deepEqual(
        globs({ turbopack: { rules: { [wide]: { loaders: [loader] } } } }),
        [wide, ...missing],
        `${wide} with ${JSON.stringify(loader)} must suppress exactly ${covered.join(", ")}`,
      );
    }
  }

  assert.deepEqual(
    globs({
      turbopack: {
        rules: {
          "*.{ts,tsx}": { condition: "browser", loaders: [LOADER] },
        },
      },
    }),
    ["*.{ts,tsx}", ...AUTOMATIC_RULE_GLOBS],
    "conditional coverage under an alternate glob must suppress nothing",
  );

  // Everything the guard does not recognise keeps all wrapper rules.
  // `{src/,}*.ts` is why recognition is an exact set and not a predicate: set
  // semantics say its bare `*.ts` alternative covers the project, and Turbopack
  // matches nothing with it, so recognising it left every module with no rule
  // at all — samchon/ttsc#1310 caused by the guard meant to prevent it. The
  // unmeasured brace shapes beside it would have been accepted by that same
  // predicate on the same kind of reasoning (samchon/ttsc#1319).
  for (const refused of REFUSED_GLOBS) {
    assert.deepEqual(
      globs({ turbopack: { rules: { [refused]: { loaders: [LOADER] } } } }),
      [refused, ...AUTOMATIC_RULE_GLOBS],
      `${refused} is not a measured project-wide spelling, so it must suppress nothing`,
    );
  }
}

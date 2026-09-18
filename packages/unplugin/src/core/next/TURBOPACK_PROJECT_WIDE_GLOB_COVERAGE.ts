import { TYPESCRIPT_TRANSFORM_EXTENSIONS } from "../source/TYPESCRIPT_TRANSFORM_EXTENSIONS";

/** The source extensions without their leading dot, in shared-table order. */
const TYPESCRIPT_EXTENSION_NAMES = TYPESCRIPT_TRANSFORM_EXTENSIONS.map(
  (extension) => extension.slice(1),
);

/** Every family of two or more source extensions a brace glob can name. */
const TYPESCRIPT_EXTENSION_GROUPS = extensionCombinations(
  TYPESCRIPT_EXTENSION_NAMES,
);

/**
 * The exact glob spellings a real Turbopack build has shown to name every file
 * with an extension, and which extensions each one covers.
 *
 * An allowlist rather than a predicate, because recognising a glob is a claim
 * about Turbopack's matcher and every claim here has to be one somebody
 * measured. A rule inferred from glob semantics kept being wrong in the silent
 * direction: `{src/,}*.ts` contains a bare `*.ts` alternative and so must cover
 * the project by any set-theoretic reading, yet Turbopack matches nothing with
 * it, and recognising it suppressed this wrapper's rules in favour of a rule
 * that transforms no file at all — samchon/ttsc#1310 caused by the guard meant
 * to prevent it (samchon/ttsc#1319).
 *
 * The deeper problem was that a predicate is open-ended: it answers for every
 * spelling anyone might write, including ones no build has ever driven.
 * `*.{ts}` and `{,**` + `/}*.ts` were both accepted on that reasoning while
 * nothing had checked whether Turbopack expands a single-alternative group or a
 * leading empty one. An exact set cannot overreach, so an unmeasured spelling
 * is simply not recognised, the wrapper adds its own rules, and the failure —
 * if any — is a second registration rather than a module that no loader ever
 * sees.
 *
 * It is exported so `experimental/test-unplugin` can read it from the installed
 * package instead of keeping a second list that could drift from it. That test
 * drives every entry through one `next build --turbopack` and asserts that
 * root, nested, and deep `.ts`, `.tsx`, `.mts`, and `.cts` sources match
 * exactly the extension family recorded here. An entry therefore cannot be
 * recognised without that same build measuring it.
 */
export const TURBOPACK_PROJECT_WIDE_GLOB_COVERAGE: ReadonlyArray<
  readonly [string, readonly string[]]
> = Object.freeze([
  ...TYPESCRIPT_EXTENSION_NAMES.flatMap((extension) => {
    const extensions = Object.freeze([extension]);
    return [
      Object.freeze([`*.${extension}`, extensions] as const),
      Object.freeze([`**/*.${extension}`, extensions] as const),
      Object.freeze([`{**/,}*.${extension}`, extensions] as const),
    ];
  }),
  ...TYPESCRIPT_EXTENSION_GROUPS.flatMap(projectWideBraceGlobEntries),
]);

/** Every source-extension subset of size two or more, in shared-table order. */
function extensionCombinations(
  extensions: readonly string[],
): ReadonlyArray<readonly string[]> {
  const output: Array<readonly string[]> = [];
  const visit = (start: number, selected: string[]): void => {
    for (let index = start; index < extensions.length; index += 1) {
      const next = [...selected, extensions[index]!];
      if (next.length >= 2) output.push(Object.freeze(next));
      visit(index + 1, next);
    }
  };
  visit(0, []);
  return output;
}

/** Measured project-wide brace spellings for one extension family. */
function projectWideBraceGlobEntries(
  extensions: readonly string[],
): ReadonlyArray<readonly [string, readonly string[]]> {
  const suffixes = extensions.join(",");
  const alternatives = extensions
    .map((extension) => `*.${extension}`)
    .join(",");
  return [
    Object.freeze([`*.{${suffixes}}`, extensions] as const),
    Object.freeze([`{${alternatives}}`, extensions] as const),
    Object.freeze([`**/*.{${suffixes}}`, extensions] as const),
    Object.freeze([`**/{${alternatives}}`, extensions] as const),
    Object.freeze([`**/**/*.{${suffixes}}`, extensions] as const),
  ];
}

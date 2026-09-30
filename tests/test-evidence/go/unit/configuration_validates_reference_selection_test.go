package evidence

import "testing"

func decodeReferenceProblems(t *testing.T, reference string) []string {
  t.Helper()
  _, problems := decodeGraphConfig([]byte(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":` + reference + `
  }]}`))
  return problems
}

/**
 * Verifies a TypeScript reference refuses the singular `file`.
 *
 * Singular `file` belongs to Swagger, which owns one document. A TypeScript
 * population is always a module set, so accepting the key would leave a
 * configuration that reads as selecting something and selects nothing.
 *
 *  1. Configure `file` on a TypeScript reference.
 *  2. Decode the configuration.
 *  3. Assert the key is rejected and names the repair.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts the singular file key on a TypeScript reference is refused with the files-glob repair.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases The singular file key on a TypeScript reference is refused with the files-glob repair.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticConfigurationRejectsFileOnTypeScriptReferences(t *testing.T) {
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"typescript","file":"src/index.ts"}`),
    "a TypeScript reference selects its population with 'files' globs",
  )
}

/**
 * Verifies a local TypeScript reference must select something.
 *
 * There is no implicit project population: guessing one would make the
 * obligation depend on a convention the configuration never states, and an
 * obligation nobody declared is worse than none.
 *
 *  1. Configure a local reference with no selector.
 *  2. Decode the configuration.
 *  3. Assert the omission is rejected and names the repair.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts a local TypeScript reference cannot omit its explicit files selector.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases A local TypeScript reference cannot omit its explicit files selector.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticConfigurationRejectsALocalReferenceWithNoSelector(t *testing.T) {
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"typescript"}`),
    "needs 'files' globs",
  )
}

/**
 * Verifies a package reference needs no selector.
 *
 * The negative twin of the case above. A package can name its own declaration
 * entry, so requiring one from the consumer would be asking them to restate
 * what the manifest already says.
 *
 *  1. Configure a package reference with neither selector.
 *  2. Decode the configuration.
 *  3. Assert it is accepted.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts a package reference without a local selector is accepted as the adjacent negative twin of local reference omission.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases A package reference without a local selector is accepted as the adjacent negative twin of local reference omission.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticConfigurationAcceptsAPackageReferenceWithNoSelector(t *testing.T) {
  problems := decodeReferenceProblems(t, `{"type":"typescript","package":"@org/api"}`)
  if len(problems) != 0 {
    t.Fatalf("a package reference should need no selector, got:\n%v", problems)
  }
}

/**
 * Verifies only TypeScript references accept a package.
 *
 * Markdown and Swagger evidence lives in this project. Accepting the key for
 * them would silently ignore it, leaving a configuration that reads as
 * selecting a package and does not.
 *
 *  1. Configure a package on a Markdown reference.
 *  2. Decode the configuration.
 *  3. Assert the key is rejected for that artifact kind.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts a Markdown reference cannot select a package even when it also supplies local files.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases A Markdown reference cannot select a package even when it also supplies local files.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticConfigurationRejectsAPackageOnNonTypeScriptReferences(t *testing.T) {
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"markdown","package":"@org/api","files":["docs/**"]}`),
    "only a TypeScript reference can select an installed package",
  )
}

/**
 * Verifies a path in the package slot is rejected with the right repair.
 *
 * `./lib` and `@org/api/lib` are the two ways someone reaches for a local or
 * nested selection through the wrong key, and each has a different correct
 * answer, so the diagnostics differ.
 *
 *  1. Configure a relative path and a deep package path.
 *  2. Decode each configuration.
 *  3. Assert each is told which key it wanted.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts relative filesystem and deep package paths receive their different literal files-selector repairs.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases Relative filesystem and deep package paths receive their different literal files-selector repairs.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticConfigurationRejectsPathsInThePackageSlot(t *testing.T) {
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"typescript","package":"./lib"}`),
    "use 'files' for a local population",
  )
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"typescript","package":"@org/api/lib"}`),
    "narrow it with 'files'",
  )
}

/**
 * Verifies an unknown reference key is still rejected.
 *
 * Adding two keys widens the accepted set, and a decoder that stopped checking
 * would let a typo like `packages` decode to the zero value and silently select
 * the local project instead.
 *
 *  1. Configure a misspelled key.
 *  2. Decode the configuration.
 *  3. Assert it is named as unknown.
  * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts the packages misspelling remains an unknown-property failure instead of silently becoming a local reference.
 * @evidence contracts/testing.md#independent-expectations Literal supported model values and repair fragments are authored independently of the decoder; no decoder result supplies the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases The packages misspelling remains an unknown-property failure instead of silently becoming a local reference.
 * @evidence contracts/testing.md#execution-ownership This named semantic unit calls the authored Go decoder and its pure assertion helpers in the shared test process; JSON mentioning Prisma, Swagger or a package performs no artifact loading, installation, native build or child process.
 */
func TestEvidenceSemanticConfigurationStillRejectsUnknownReferenceKeys(t *testing.T) {
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"typescript","packages":"@org/api"}`),
    "unknown property",
  )
}

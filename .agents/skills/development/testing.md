# Testing

Read this document before writing, moving, consolidating or removing tests and fixtures. Read the [test contracts](../contracts/SKILL.md#testing) for every test and the [E2E contracts](../contracts/SKILL.md#e2e) for real boundary execution. Those checklists own assertion quality and layer meaning; this document owns how to construct and organize the tests. Use [Evidence adoption](evidence.md) for selection and [validation](validation.md) for execution.

## Choose The Owner

1. Trace the actual operations executed by the case, including helpers, callbacks, preparation and cleanup. Apply [execution ownership](../contracts/testing.md#execution-ownership) to that path before choosing its location.
2. For an existing case, compare each assertion with the [behavioral verification](../contracts/testing.md#behavioral-verification) chapter. Delete fake units and checks with no behavioral value. Do not transfer them to E2E or retain them under a new name. Export lists, version strings and repository file, manifest, source or workflow shape checks are not behavior merely because a runner executes them. Distinguish those checks from an actual resolver reading a fixture manifest, supported constants or an installed entry exercising its public operation.
3. For meaningful portable behavior currently reached through E2E, first establish and execute its direct unit coverage. Retain the real connection assertions required by [necessary boundary](../contracts/e2e.md#necessary-boundary); remove a meaningful assertion only after verifying its surviving owner.
4. Derive missing cases from the owning operation and the [consequence analysis](implementation.md#consequence-analysis). Add needed positive, negative and boundary distinctions with independent expectations, then write their acknowledgments, execute them and verify those explanations against the actual body and callees.

## Locations And Entries

| Population | Location and entry |
| --- | --- |
| Go tests and Go fixtures | The owning package under `packages/`, beside its Go implementation or within its existing `test/` structure. Keep one `Test*` entry per case file, named after its assertion, and execute portable operations in the same Go test process. |
| TypeScript units | `tests/test-*/src/features/`, with one exported `test_<snake_case>` function in the matching file. Call the actual owning source operation directly. |
| TypeScript E2E | The single `tests/test-e2e` module, with one package experiment at `src/features/test_e2e_<package>.ts`, exporting the matching function. Keep scenarios and their failure identities within that experiment. |
| E2E authored inputs | `tests/test-e2e/fixtures/<package>/<scenario>/`, containing the actual static input files. |

Do not put Go source, Go fixtures or `go.mod` under `tests/`. Use the actual preparation path to enforce [execution ownership](../contracts/testing.md#execution-ownership), including cases with real directory inputs. Necessary command entrypoint checks remain in the shared E2E population.

The package experiment is the E2E discovery entry, not a wrapper that calls hundreds of old test entries with their original preparation intact. Scenario functions retain their own assertions and explanations even when the runner discovers only the experiment. Verify their selected addresses and report any unaddressable bodies through [Evidence adoption](evidence.md).

## Construct The Case

1. Identify the supported operation, observable result and defect the case must distinguish. Apply the existing-convention rule in [implementation](implementation.md#work-rules).
2. Choose an expectation from the supported contract or another independent basis under [independent expectations](../contracts/testing.md#independent-expectations). Identify that independent basis before writing the assertion.
3. Select the contrasting inputs under [distinguishing cases](../contracts/testing.md#distinguishing-cases). Assert the actual result and relevant unchanged meaning. Keep the case's contribution identifiable within the operation's matrix.
4. Call the actual owning API or operation. Reuse helpers in `tests/utils` and the suite's own `internal/` modules; do not import another suite's internals. Give shared preparation one owner rather than creating duplicate utility modules.
5. Document the case and add the applicable acknowledgments below, then execute it through its owning runner. Inspect the body, callbacks and called helpers again so the explanation describes what actually ran.

Open each case with native documentation: a `Verifies` headline, a short paragraph explaining the non-obvious branch or regression, and a numbered list of two to four scenario steps. Go documentation begins with the `Test*` name, followed by the verification headline. TypeScript uses a doc comment immediately before its exported entry. Describe the package experiment's shared lifecycle and give each scenario its own explanation.

Every unit and E2E case answers these chapters with its actual operation and assertions:

- [Behavioral verification](../contracts/testing.md#behavioral-verification)
- [Independent expectations](../contracts/testing.md#independent-expectations)
- [Distinguishing cases](../contracts/testing.md#distinguishing-cases)
- [Execution ownership](../contracts/testing.md#execution-ownership)

E2E cases also answer these chapters:

- [Necessary boundary](../contracts/e2e.md#necessary-boundary)
- [Shared execution](../contracts/e2e.md#shared-execution)
- [State isolation and reuse validity](../contracts/e2e.md#state-isolation-and-reuse-validity)
- [Preserved coverage](../contracts/e2e.md#preserved-coverage)

Use [Evidence adoption](evidence.md#selection-and-execution) to write and validate the tags in native documentation. The entry's answers describe its orchestration; they do not substitute for each scenario's answers.

## Fixtures

Store authored E2E source, configuration and expected file inputs as static fixture files. Read or copy them through the existing helpers instead of embedding projects as long source strings or file maps. Preserve relevant bytes, binary inputs, supported symbolic links, newline conventions and path identity. A mutation scenario may edit its copied input at runtime; the initial authored project remains a static fixture.

Use existing project-copy helpers for directory-shaped regressions. Existing `tests/projects` fixtures keep their owners; new E2E scenario inputs use the location above. Go fixture ownership follows the Go package. Use [Evidence provenance selection](evidence.md#selection-and-execution) to distinguish copied product inputs from authored test declarations.

Apply [validation input ownership](validation.md#inputs-and-results) to source, generated output, caches and fixtures used by a shared run. Apply [consequence analysis](implementation.md#consequence-analysis) to new files and writes observed by directory walks, watchers, cache keys or timestamps.

## Consolidate E2E Execution

1. Inventory every meaningful scenario's inputs, oracle, assertions and necessary connection. Map each assertion to its surviving direct unit case or package experiment before removing an old entry.
2. Inventory actual installations, native builds, project loads and process sessions. Group consumers with equivalent inputs around one preparation, following [shared execution](../contracts/e2e.md#shared-execution). Reuse the same installed artifact and session when valid; record the changed input or conflicting state that requires any additional preparation.
3. Place the scenarios within the package experiment and execute independent cases even when another case fails. Preserve individual failure identities and collect their observable failures; a failed prerequisite may block only its dependent cases.
4. Apply [state isolation and reuse validity](../contracts/e2e.md#state-isolation-and-reuse-validity) to each shared resource. Exercise cold and invalidated states through real transitions when those are the assertion. Assign process, handle and directory owners and await their actual cleanup on success, failure and cancellation before restoring shared inputs.
5. Compare preparation counts and executable assertion owners before and after consolidation. Smaller file or function counts do not establish reduced work or preserved coverage. Execute the final population, verify discovery and Evidence selection together, and report unresolved assertions or resource lifetimes.

Use the [validation README](../../../scripts/ci/README.md) for platform selections, the shared boundary batch, the single installation matrix, CI jobs, caching and measured duration acceptance. Classify filesystem cases by their actual connection under [execution ownership](../contracts/testing.md#execution-ownership) before applying that selection.

Commit only tests that are meaningful and necessary for the change. Keep scratch probes and one-off working checks outside the repository.

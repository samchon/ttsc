# Review Round 9 Lead Validation

The lead accepted the test-integrity proposal because the test was added in
this PR and an ambient declaration preserves the same runtime scenario without
masking other diagnostics.

Applied:

- `tests/test-ttsc/src/features/ttsx-runtime/test_ttsx_esm_rewrite_preserves_query_and_hash_on_extensioned_specifiers.ts`
  now declares wildcard modules for query/hash specifiers in the fixture
  instead of using `@ts-ignore`.

Because a proposal was accepted, run fresh round 10 before stopping the 4.3
review loop.

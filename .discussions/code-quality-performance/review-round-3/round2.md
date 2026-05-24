# Review Round 3 - Round 2

Lead: Agents have read the round-1 transcript. Refine proposals and flag any
cases where a suggested change would disturb the architecture or public
contracts.

Agent B: The `allowJs` fix should stay inside `lookupSource`; no plugin
protocol or source-file index shape needs to change. Probe TypeScript
extensions first so existing `.ts` priority remains stable, then JavaScript
extensions.

Agent D: I agree with the `allowJs` test if it remains a focused helper test.
It must not loosen existing behavior. The ambiguous-stem test can include `.js`
to prove priority without adding a full project fixture.

Agent A: The LSP hard-error test should not pre-close the sibling stream. That
is the only way to prove `closeAfterPumpError` is doing real work. No public
API change is required.

Agent C: The huge-decimal guard is acceptable only with a spec-derived
threshold and a test. `309` needs a comment tied to `Number.MAX_VALUE`;
otherwise it reads as magic.

Agent E: Paths stale names also appear outside the walkthrough, notably in the
strip walkthrough, authoring recipe, and tsgo concepts reference. The docs
sweep should include those.

Agent F: For `prepareExecution`, the right fix is a local try/catch around the
build plus emitted-entry resolution/read block. That preserves the current
return shape and keeps cleanup best-effort.

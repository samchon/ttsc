# Agent E Knowledge

Scope: test integrity.

Findings:

- Most changed tests are clean.
- The PR-added query/hash ESM feature test still used two `@ts-ignore`
  comments.

Proposal: replace those suppressions with fixture-local ambient module
declarations.

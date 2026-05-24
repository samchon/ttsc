# Review Round 4 - Round 2

Lead: Agents read round 1 and refine only technically sound proposals.

Agent B: The emitted suffix fix must follow TypeScript-Go behavior: `.mjs` and
`.cjs` preserve their suffixes; `.tsx`/`.jsx` emit `.jsx` only when `jsx` is
`preserve`, otherwise `.js`.

Agent E: The paths plugin page should not imply it rewrites arbitrary
extensionless relative imports. It rewrites matched path aliases and uses the
compiler's emitted suffix for the target.

Agent A: The preload docs should explicitly say Node receives the preload
directly; otherwise users will expect `ttsx` to compile a `.ts` preload.

Agent D: The banner test can keep behavior-level ordering and restore the exact
initializer string. That avoids both brittleness and weakening.

Agent F: Command-level allowJs paths coverage should use the existing
`tests/test-paths` harness and not add a parallel fixture system.

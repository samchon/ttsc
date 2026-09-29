# AST Printing

Apply to `packages/factory/src/factory/`, `TsPrinter.ts`, printer layout helpers, and synthetic-comment storage. Pure AST interfaces describe their shape without claiming they render text.

The existing contracts are [factory signatures](../../../packages/factory/README.md#factory), [printer behavior](../../../packages/factory/README.md#tsprinter), and [synthetic comments](../../../packages/factory/README.md#comments).

## Change layout without changing meaning

For builders, identify the legacy API shape and concrete node kind produced. For printing, identify how precedence, punctuation, holes, rest elements, and significant JSX text retain their meaning across the layout choices the operation supports. A different print width may select different whitespace, not a different program.

For comments, explain storage ownership, frozen-node compatibility, and visibility between compatible copies or the documented private-store fallback. Keep the factory and printer independent of a runtime TypeScript compiler dependency.

A trailing comma or newline can change meaning rather than appearance. Comment metadata written directly to a node can also break frozen nodes or disappear when another compatible package copy prints it.

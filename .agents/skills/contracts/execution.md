# Checked Execution

Apply to compiler execution and TypeScript loading, especially `packages/ttsc/src/compiler/`, `src/launcher/internal/runtime/`, and `src/register.ts`. Configuration types and unrelated CLI parsing do not each implement the execution gate.

The behavior belongs to the [project product contract](../project/SKILL.md#product-contract) and the [runtime hook contract](../../../packages/ttsc/src/launcher/internal/runtime/installRuntimeHooks.ts).

## Check before execution

Identify which owning project and module format the operation selects, where the real compiler and configured plugins run, and how a failed check prevents the affected source from executing. Explain how the served emit belongs to that checked source and how source URLs and maps retain their intended meaning.

The hook contract distinguishes entry-project output, dependencies with their own tsconfig, and dependencies without an owning project. Name the path this operation implements rather than claiming that every module follows the same loading policy.

Distinguish an intentionally absent or disabled plugin from a selected plugin whose descriptor, native build or execution failed. State how the latter failure reaches the caller and prevents execution and successful-generation publication. Emit-only handling of dependency type diagnostics does not authorize replacing a failed required transform with untransformed execution.

A fallback can preserve a successful exit while running a different program from the one the dependency's configuration requires. A diagnostic on stderr alone does not establish that the execution gate held.

Type stripping can leave runtime imports the real compiler would erase. Serving output from the wrong project or generation can also run code that was never checked under the consumer's actual contract.

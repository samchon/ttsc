# Source And Editor Edits

Apply to fix selection and writes in `packages/lint/linthost/`, and to command-result edits in `packages/vscode/src/commandEdits.ts` and `extension.ts`. Diagnostic reporting without edits does not by itself implement a write policy.

The contracts are [fix command behavior](../../../packages/lint/README.md#setup), [format behavior](../../../packages/lint/README.md#format), [native fix orchestration](../../../packages/lint/linthost/fix.go), and [editor edit validation](../../../packages/vscode/src/commandEdits.ts).

## Apply edits to the intended source

Identify the writable source population, the snapshot and coordinate system edits refer to, and the validation that prevents invalid or conflicting changes. Explain how the editor path handles dirty documents and applies a returned WorkspaceEdit, or how the native path limits writes to the project's owned files.

For fix orchestration, identify recheck and non-convergence behavior. Source may remain modified when a final check fails; do not promise rollback the command does not perform. For formatting, explain preservation of runtime import evaluation order and any explicit unsafe opt-in.

A valid diagnostic range is not permission to write every imported file. An otherwise valid command result can also overwrite a newer editor buffer, and a successful formatting pass can change behavior if it reorders runtime-bearing imports.

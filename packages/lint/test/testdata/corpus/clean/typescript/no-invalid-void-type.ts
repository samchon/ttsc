// @ttsc-corpus-clean: typescript/no-invalid-void-type
type Completion = Promise<void>;
function f(): void { void 0; }

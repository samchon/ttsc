// @ttsc-corpus-clean: typescript/require-await
async function hasAwait(): Promise<void> { await Promise.resolve(); }

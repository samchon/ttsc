const plugin = { make(): string { return "original"; } };
export const marker = "/* @ttsc-rewritten */";
// /* @ttsc-rewritten */
/* @ttsc-rewritten */
export const value = plugin.make();

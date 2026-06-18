// Re-export `@rollup/plugin-typescript` from the build-config package.
//
// The plugin statically imports `typescript` and needs the classic JS compiler
// API, which native TypeScript 7 drops. This package pins a legacy v6
// `typescript`, so any rollup config that imports the plugin through here (e.g.
// `@ttsc/unplugin`'s standalone config) gets the plugin's `typescript` peer
// resolved to v6 instead of the consumer's own native `typescript@7`.
export { default } from "@rollup/plugin-typescript";

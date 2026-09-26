/**
 * An empty CommonJS module that `RuntimeLoaderCapabilities` imports from ESM to
 * read the namespace shape this runtime gives an imported CommonJS module.
 *
 * It must stay free of side effects and exports: only the names the runtime
 * adds on its own, such as `module.exports`, may appear in that namespace.
 */
export {};

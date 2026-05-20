import { assertSharedAdapterFilter } from "../../internal/adapter-entrypoints";

/**
 * Verifies shared adapter filter accepts source files and skips declarations.
 *
 * Every bundler adapter delegates file-inclusion to the shared
 * `transformInclude` predicate. Passing a `.d.ts` file, a `.js`/`.jsx` file, a
 * `node_modules` path, or a virtual-module path (prefix `\0`) to the transform
 * would corrupt output or break caching. This pins the exact accept/reject
 * boundary so any future change to the filter is explicit.
 *
 * 1. Load the unplugin API and obtain the raw unplugin instance.
 * 2. Assert `transformInclude` returns `true` for `.ts` and `.tsx` paths.
 * 3. Assert it returns `false` for `.js`, `.jsx`, `.css`, `node_modules`, `.d.ts`,
 *    and virtual-module paths.
 */
export const test_shared_adapter_filter_accepts_source_files_and_skips_declarations =
  async () => {
    await assertSharedAdapterFilter();
  };

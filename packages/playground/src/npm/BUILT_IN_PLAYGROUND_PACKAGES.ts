/**
 * Packages the typia source pack already mounts inside the wasm. The npm
 * installer skips these so it doesn't try to fetch typia / @typia/* from the
 * registry on top of the mounted source tree.
 */
export const BUILT_IN_PLAYGROUND_PACKAGES = [
  "typia",
  "@typia/interface",
  "@typia/utils",
  "@standard-schema/spec",
] as const;

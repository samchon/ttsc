/**
 * The compiler options every playground tsconfig opts into by default. Sites
 * pass these straight to `buildTsconfigJSON`; consumer code that needs a tweak
 * spreads the constant and overrides individual fields.
 *
 * Enum-typed options (`target`, `moduleResolution`, `module`) are spelled with
 * their string names. The wasm runs the real tsgo configuration parser, which
 * validates enum options against their name map and rejects raw numbers with
 * `TS5024: Compiler option '…' requires a value of type enum.` — so a numeric
 * `target: 99` aborts the whole compile and leaves the JS pane blank.
 */
export const DEFAULT_PLAYGROUND_COMPILER_OPTIONS = {
  target: "ESNext",
  esModuleInterop: true,
  forceConsistentCasingInFileNames: true,
  moduleResolution: "Bundler",
  strict: true,
  skipLibCheck: true,
  experimentalDecorators: true,
} as const;

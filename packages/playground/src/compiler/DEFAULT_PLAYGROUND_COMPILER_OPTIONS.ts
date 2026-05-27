/**
 * The compiler options every playground tsconfig opts into by default. Sites
 * pass these straight to `buildTsconfigJSON`; consumer code that needs a tweak
 * spreads the constant and overrides individual fields.
 *
 * `target` and `module` are TypeScript's numeric enum values (99 = ESNext,
 * 199 = NodeNext, …). They are spelled numerically here because the wasm
 * doesn't run the TS configuration parser through a string→enum step before
 * Go reads the JSON; passing the canonical numbers avoids version-drift.
 */
export const DEFAULT_PLAYGROUND_COMPILER_OPTIONS = {
  target: 99,
  esModuleInterop: true,
  forceConsistentCasingInFileNames: true,
  moduleResolution: 100,
  strict: true,
  skipLibCheck: true,
  experimentalDecorators: true,
} as const;

/**
 * A pnpm-shaped fixture for Vite serve resolution-candidate scenarios.
 *
 * The consumer app depends on a workspace package linked into `node_modules` (a
 * junction on Windows, a directory symlink on POSIX, exactly how pnpm links
 * workspace members). The package's `main` is `index.js` under `allowJs`, so
 * the compiler's candidate search records missing higher-priority probes —
 * `node_modules/linked-pkg/index.ts` above all — in the transform envelope's
 * `graph.candidates` for the requesting module.
 */
export interface IViteServeCandidateFixture {
  /** Consumer application root served by Vite. */
  app: string;
  /** Real directory of the linked workspace package (the link target). */
  linkedPackage: string;
  /** Absolute path of the app's entry module (`src/main.ts`). */
  mainFile: string;
  /** Existing empty automatic type root whose membership is compiler input. */
  typeRoot: string;
  /**
   * The missing higher-priority candidate as the compiler spells it: the
   * `node_modules` view of the superseding TypeScript source.
   */
  missingCandidate: string;
  /**
   * Where a test writes the superseding source: inside the link target, so the
   * file appears at {@link missingCandidate} through the link like a real
   * workspace edit.
   */
  supersedingSource: string;
}

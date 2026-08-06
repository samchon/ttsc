import path from "node:path";

/**
 * Where the benchmark's own files are, separately from the workspace's.
 *
 * Two roots are in play here and they are not the same directory. The
 * repository owns the git history, the pnpm catalog, and `packages/evidence`;
 * the templates, requirements, instructions, and run output belong to this
 * package. Upstream the benchmark sat directly at `<repository>/benchmark`, so
 * one value answered both questions and every call site spelled the join
 * itself. In this workspace it does not, and a call site that spells the
 * location again is a call site that can drift away from this one.
 */
export namespace EvidenceBenchmarkLayout {
  /** Path of this package relative to the repository that contains it. */
  const PACKAGE_PATH: readonly string[] = ["benchmarks", "evidence"];

  /**
   * Absolute path of the repository this package was loaded from.
   *
   * Anchored on the module rather than on the working directory, so an
   * executable behaves the same however it is launched. Both `src` and `lib`
   * place this file one directory below the package root.
   */
  export const repositoryRoot: string = path.resolve(
    __dirname,
    "..",
    ...PACKAGE_PATH.map(() => ".."),
  );

  /**
   * Absolute path of the benchmark's asset tree inside `repository`.
   *
   * Takes the repository rather than answering from {@link repositoryRoot},
   * because callers hand in the tree they are measuring: the feature suite
   * points every case at the working tree under test, never at a fixture that
   * imitates it.
   */
  export const assetsRoot = (repository: string): string =>
    path.join(repository, ...PACKAGE_PATH);

  /**
   * Where the published charts are written, inside `repository`.
   *
   * The aggregate holds the measurement and the charts are a rendering of it,
   * so they live where they are served rather than beside the JSON they were
   * drawn from. Keeping them under the benchmark meant the website copied them
   * across at build time, which put a second copy of every chart in the tree
   * for a directory nothing but the site reads.
   */
  export const chartsRoot = (repository: string): string =>
    path.join(repository, "website", "public", "benchmark", "evidence");
}

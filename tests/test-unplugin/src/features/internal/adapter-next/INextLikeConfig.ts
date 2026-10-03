/** The slice of a Next.js config `withTtsc` reads and returns. */
export interface INextLikeConfig {
  /**
   * Turbopack configuration, whose `rules` receive the ttsc loader, and whose
   * `root` the loader keeps its dependencies inside.
   */
  turbopack?: { root?: string; rules?: Record<string, unknown> };
  /** The webpack hook `withTtsc` wraps. */
  webpack?: (config: { plugins?: unknown[] }, options: unknown) => unknown;
  [key: string]: unknown;
}

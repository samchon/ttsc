/** The slice of a Next.js config `withTtsc` reads and returns. */
export interface INextLikeConfig {
  /** Turbopack configuration, whose `rules` receive the ttsc loader. */
  turbopack?: { rules?: Record<string, unknown> };
  /** The webpack hook `withTtsc` wraps. */
  webpack?: (config: { plugins?: unknown[] }, options: unknown) => unknown;
  [key: string]: unknown;
}

export interface INextLikeConfig {
  turbopack?: { rules?: Record<string, unknown> };
  webpack?: (config: { plugins?: unknown[] }, options: unknown) => unknown;
  [key: string]: unknown;
}

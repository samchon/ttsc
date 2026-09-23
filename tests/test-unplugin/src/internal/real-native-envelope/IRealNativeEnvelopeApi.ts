import type { RealNativeEnvelopeCache } from "./RealNativeEnvelopeCache";

/** The slice of `@ttsc/unplugin/api` the real native envelope scenarios drive. */
export interface IRealNativeEnvelopeApi {
  /** Open a delivery pass on the cache. */
  beginTtscTransformBuild(cache: RealNativeEnvelopeCache): void;
  /**
   * Create an empty transform cache, reading through the filesystem operations
   * given in place of the host's.
   */
  createTtscTransformCache(operations?: {
    readFile?(location: string): Buffer | string;
  }): RealNativeEnvelopeCache;
  /** Discard every generation and its watchers. */
  resetTtscTransformCache(cache: RealNativeEnvelopeCache): void;
  /** Normalize adapter options. */
  resolveOptions(options: {
    compilerOptions?: Record<string, unknown>;
    project: string;
  }): unknown;
  /** Declare the cache's compiles shared through the pooled host session. */
  shareTtscTransformCache(
    cache: RealNativeEnvelopeCache,
    session: string,
  ): void;
  /** Transform one module through the shared cache. */
  transformTtsc(
    file: string,
    source: string,
    options: unknown,
    aliases: undefined,
    cache?: RealNativeEnvelopeCache,
  ): Promise<{ code: string } | undefined>;
}

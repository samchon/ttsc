import type { RealNativeEnvelopeCache } from "./RealNativeEnvelopeCache";

export interface IRealNativeEnvelopeApi {
  beginTtscTransformBuild(cache: RealNativeEnvelopeCache): void;
  createTtscTransformCache(): RealNativeEnvelopeCache;
  resetTtscTransformCache(cache: RealNativeEnvelopeCache): void;
  resolveOptions(options: {
    compilerOptions?: Record<string, unknown>;
    project: string;
  }): unknown;
  transformTtsc(
    file: string,
    source: string,
    options: unknown,
    aliases: undefined,
    cache?: RealNativeEnvelopeCache,
  ): Promise<{ code: string } | undefined>;
}

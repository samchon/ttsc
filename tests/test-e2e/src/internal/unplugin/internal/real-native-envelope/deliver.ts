import fs from "node:fs";

import type { IRealNativeEnvelopeApi } from "./IRealNativeEnvelopeApi";
import type { RealNativeEnvelopeCache } from "./RealNativeEnvelopeCache";

/** Deliver one source file through the public transform API. */
export async function deliver(
  api: IRealNativeEnvelopeApi,
  cache: RealNativeEnvelopeCache,
  options: unknown,
  file: string,
): Promise<void> {
  await api.transformTtsc(
    file,
    fs.readFileSync(file, "utf8"),
    options,
    undefined,
    cache,
  );
}

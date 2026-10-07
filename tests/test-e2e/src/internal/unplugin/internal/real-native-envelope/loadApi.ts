import { TestUnpluginRuntime } from "@ttsc/testing";

import type { IRealNativeEnvelopeApi } from "./IRealNativeEnvelopeApi";

/** Load the compiled public unplugin API exercised by consumers. */
export async function loadApi(): Promise<IRealNativeEnvelopeApi> {
  return (await TestUnpluginRuntime.loadUnpluginApi()) as IRealNativeEnvelopeApi;
}

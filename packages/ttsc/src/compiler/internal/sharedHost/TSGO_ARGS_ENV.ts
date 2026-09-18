/**
 * Environment channel carrying the JSON-encoded tsgo argv ttsc forwards to a
 * native sidecar. Mirrors `driver.TsgoArgsEnv` on the Go side; see
 * `TsgoArguments.ts::createNativeTsgoArgs` for why the payload is not a CLI flag.
 */
export const TSGO_ARGS_ENV = "TTSC_TSGO_ARGS";

import { TsgoArguments } from "../../../../../packages/ttsc/lib/compiler/internal/build/TsgoArguments.js";
import { assert } from "../../internal/toolchain";

/**
 * Verifies a native host's tsgo payload drops only well-formed timing flags.
 *
 * A native host reports timing through its own channel, so ttsc removes
 * `--diagnostics` and `--extendedDiagnostics` from the payload it forwards.
 * The removal used to accept `--diagnostics=false` and an uppercase `TRUE`
 * value, which tsgo rejects, so a malformed invocation vanished into a
 * successful plugin build while the plain lane failed on it.
 *
 * 1. Build payloads for well-formed occurrences in any flag casing, with a
 *    `true`/`false`/`null` value or none.
 * 2. Build payloads for an inline `=` spelling and an uppercase value.
 * 3. Assert only the well-formed occurrences and their values are removed.
 */
export const test_ttsc_native_payload_keeps_malformed_diagnostics_tokens =
  () => {
    const payload = (passthrough: string[]) =>
      TsgoArguments.createNativeTsgoArgs({ passthrough });

    assert.deepEqual(
      JSON.parse(
        payload([
          "--Diagnostics",
          "false",
          "--strict",
          "--extendedDiagnostics",
          "-diagnostics",
          "null",
          "--noImplicitAny",
          "true",
        ])!,
      ),
      ["--strict", "--noImplicitAny", "true"],
    );
    assert.equal(payload(["--diagnostics", "true"]), undefined);
    assert.deepEqual(JSON.parse(payload(["--diagnostics", "TRUE"])!), [
      "TRUE",
    ]);
    assert.deepEqual(JSON.parse(payload(["--diagnostics=false"])!), [
      "--diagnostics=false",
    ]);
  };

import { TsgoArguments } from "../../../../../packages/ttsc/src/compiler/internal/build/TsgoArguments";
import assert from "node:assert/strict";

/**
 * Verifies a native host's tsgo payload drops only well-formed timing flags.
 *
 * A native host reports timing through its own channel, so ttsc removes
 * `--diagnostics` and `--extendedDiagnostics` from the payload it forwards. The
 * removal used to accept `--diagnostics=false` and an uppercase `TRUE` value,
 * which tsgo rejects, so a malformed invocation vanished into a successful
 * plugin build while the plain lane failed on it.
 *
 * 1. Build payloads for well-formed occurrences in any flag casing, with a
 *    `true`/`false`/`null` value or none.
 * 2. Build payloads for an inline `=` spelling and an uppercase value.
 * 3. Assert only the well-formed occurrences and their values are removed.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls TsgoArguments.createNativeTsgoArgs and decodes its JSON to check timing-option removal, unrelated argv order, an empty payload and preservation of malformed inline spelling and uppercase trailing value.
 * @evidence contracts/testing.md#independent-expectations The expected arrays are authored literals: a timing flag is removed with a separate lowercase true/false/null value in any casing or dash count, and an inline =false or an uppercase TRUE value is kept for the compiler to reject. This follows the tsgo grammar described in the doc comment; tsgo itself is not executed here, so a drift in that grammar would not be detected by this test.
 * @evidence contracts/testing.md#distinguishing-cases Mixed case, one dash, absent values and lowercase false/null/true are removal controls. --diagnostics=false stays intact; --diagnostics TRUE removes the valid option but leaves TRUE for compiler diagnosis; strict and noImplicitAny adjacency remains unchanged.
 * @evidence contracts/testing.md#execution-ownership This exported source-unit entry calls the actual argv-to-JSON composer through its local payload wrapper. JSON.parse only observes transport data; no native sidecar, compiler process or installation executes.
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
    assert.deepEqual(JSON.parse(payload(["--diagnostics", "TRUE"])!), ["TRUE"]);
    assert.deepEqual(JSON.parse(payload(["--diagnostics=false"])!), [
      "--diagnostics=false",
    ]);
  };

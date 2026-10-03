import { TsgoArguments } from "../../../../../packages/ttsc/src/compiler/internal/build/TsgoArguments";
import assert from "node:assert/strict";

/**
 * Verifies a native host's tsgo payload drops only well-formed timing flags.
 *
 * A native host reports timing through its own channel, so ttsc removes
 * `--diagnostics` and `--extendedDiagnostics` from the payload it forwards. The
 * removal must preserve the unknown inline `--diagnostics=false` token and
 * the uppercase `TRUE` token. The native parser does not consume `TRUE` as a
 * boolean operand: it enables diagnostics and treats `TRUE` as a filename.
 * This unit observes token preservation, not native filename acceptance.
 *
 * 1. Build payloads for well-formed occurrences in any flag casing, with a
 *    `true`/`false`/`null` value or none.
 * 2. Build payloads for an inline `=` spelling and an uppercase value.
 * 3. Assert only the well-formed occurrences and their values are removed.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls TsgoArguments.createNativeTsgoArgs and decodes its JSON to check timing-option removal, unrelated argv order, an empty payload and preservation of malformed inline spelling and uppercase trailing value.
 * @evidence contracts/testing.md#independent-expectations Literal arrays distinguish supported lowercase true/false/null operands, case-insensitive option names and one/two leading dashes from unknown inline =false and unconsumed uppercase TRUE. The pinned native commandlineparser.go parseOptionValue/parseStrings treats TRUE as a filename, not a boolean value; no native execution or eventual filename acceptance is observed here.
 * @evidence contracts/testing.md#distinguishing-cases Mixed case, one dash, absent values and lowercase false/null/true are removal controls. --diagnostics=false stays intact; --diagnostics TRUE removes the valid option but leaves TRUE for compiler filename processing; strict and noImplicitAny adjacency remains unchanged.
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

import assert from "node:assert/strict";

import { parseWindowsDirectoryCaseSensitivity } from "../../../../../packages/ttsc/src/internal/parseWindowsDirectoryCaseSensitivity";

/**
 * Verifies fsutil case-sensitivity parsing does not depend on English text.
 *
 * Node receives fsutil's console-code-page bytes without a portable decoder.
 * The parser must recognize English directly and compare every other locale
 * against its volume-root disabled suffix without accepting malformed
 * evidence.
 *
 * 1. Parse the two English states without a volume query.
 * 2. Parse opaque localized enabled and disabled byte messages.
 * 3. Reject a missing root marker, an empty suffix, and truncated evidence.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls parseWindowsDirectoryCaseSensitivity with raw response bytes and checks enabled, disabled and unknown results without executing fsutil.
 * @evidence contracts/testing.md#independent-expectations Literal English state words and independently authored opaque enabled/disabled suffixes define expected booleans under the successful-query and disabled-volume-root premises. The unit does not infer actual directory case support.
 * @evidence contracts/testing.md#distinguishing-cases English states need no baseline; localized equal versus unequal suffixes contrast with missing volume marker, empty suffix and truncated target evidence that must return undefined.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/watch; it parses in-memory Buffers that stand for fsutil output on any host, and starts no shell, process or filesystem case query. No real fsutil output is observed.
 */
export const test_windows_directory_case_sensitivity_parser_is_locale_independent =
  (): void => {
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.from("Case sensitive attribute is disabled.\r\n"),
        undefined,
        "C:\\",
      ),
      false,
    );
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.from("Case sensitive attribute is enabled.\r\n"),
        undefined,
        "C:\\",
      ),
      true,
    );

    const prefix = Buffer.from([0x81, 0x40, 0x82, 0x41]);
    const disabledSuffix = Buffer.from([0x90, 0x40, 0x91, 0x41, 0x0d, 0x0a]);
    const enabledSuffix = Buffer.from([0x92, 0x40, 0x93, 0x41, 0x0d, 0x0a]);
    const volume = Buffer.concat([prefix, Buffer.from("C:\\"), disabledSuffix]);
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.concat([
          prefix,
          Buffer.from("C:\\workspace\\ordinary"),
          disabledSuffix,
        ]),
        volume,
        "C:\\",
      ),
      false,
    );
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.concat([
          prefix,
          Buffer.from("C:\\workspace\\sensitive"),
          enabledSuffix,
        ]),
        volume,
        "C:\\",
      ),
      true,
    );

    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.from([0x81]),
        Buffer.from("no volume marker"),
        "C:\\",
      ),
      undefined,
    );
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(
        Buffer.from([0x81]),
        Buffer.from("C:\\"),
        "C:\\",
      ),
      undefined,
    );
    assert.equal(
      parseWindowsDirectoryCaseSensitivity(Buffer.from([0x81]), volume, "C:\\"),
      undefined,
    );
  };

import { assert, formatDuration } from "../../internal/source-build";

/**
 * Verifies formatDuration renders non-finite input without NaN tokens.
 *
 * Defense-in-depth twin of the #421 state-machine fix: the lock inspector no
 * longer encodes "lock missing" as an Infinity age, but the formatter itself
 * must also be total so no future caller can ever print the `Infinitym NaNs`
 * malformation into a user-facing diagnostic again. The finite boundary cases
 * pin the existing rendering so the guard cannot regress it.
 *
 * 1. Format `Infinity`, `-Infinity`, and `NaN`.
 * 2. Assert each renders as the fixed "an unknown time" phrase with no
 *    `Infinity`/`NaN` substring.
 * 3. Assert the finite boundaries (0, sub-second, second, minute, negative) still
 *    render exactly as before.
 */
export const test_formatduration_renders_nonfinite_input_without_nan_tokens =
  () => {
    for (const value of [
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
    ]) {
      const rendered = formatDuration(value);
      assert.equal(rendered, "an unknown time");
      assert.doesNotMatch(rendered, /Infinity|NaN/);
    }

    assert.equal(formatDuration(0), "0ms");
    assert.equal(formatDuration(-5), "0ms");
    assert.equal(formatDuration(999), "999ms");
    assert.equal(formatDuration(1_000), "1s");
    assert.equal(formatDuration(59_999), "59s");
    assert.equal(formatDuration(60_000), "1m 0s");
    assert.equal(formatDuration(123_456), "2m 3s");
  };

/**
 * Verifies regexp/no-useless-flag: flag that the literal does not exercise.
 *
 * Pins both edges of the rule. A flag whose effect is unobservable is reported:
 * `/\d+/i` has no character whose case could vary, `/\d+/m` no `^`/`$` to
 * re-anchor. A flag the pattern leans on is not, and that half used to be
 * broken -- the case scan never entered a character class, so `/[a-z]/i` was
 * told to drop the very flag that lets it match `A-Z` (issue #576). The
 * unannotated literals are the regression shield: any finding on them fails.
 *
 * 1. Declare regex literals whose flag is dead, and literals whose flag is live.
 * 2. Run the native lint engine with `regexp/no-useless-flag` enabled.
 * 3. Assert only the dead flags are reported.
 */

// expect: regexp/no-useless-flag error
const deadIgnoreCase = /\d+/i;

// expect: regexp/no-useless-flag error
const deadIgnoreCaseInClass = /[0-9]/i;

// expect: regexp/no-useless-flag error
const deadMultiline = /\d+/m;

const liveLowercaseRange = /[a-z]/i;
const liveUppercaseRange = /[A-Z]/i;
const liveClassMembers = /[abc]/i;
const liveAnchoredClass = /^[a-z]+$/i;
const liveNegatedClass = /[^a-z]/i;
const liveMultiline = /^\d+$/m;

JSON.stringify([
  deadIgnoreCase,
  deadIgnoreCaseInClass,
  deadMultiline,
  liveLowercaseRange,
  liveUppercaseRange,
  liveClassMembers,
  liveAnchoredClass,
  liveNegatedClass,
  liveMultiline,
]);

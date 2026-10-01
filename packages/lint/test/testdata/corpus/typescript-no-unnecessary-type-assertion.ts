declare const definitelyString: string;
declare const maybeString: string | undefined;
declare const literal: "foo";

// Positive: source is already `string`, so `as string` adds nothing.
// expect: typescript/no-unnecessary-type-assertion error
const a = definitelyString as string;

// Positive: old-style prefix assertion on a value that is already
// `string`.
// expect: typescript/no-unnecessary-type-assertion error
const b = <string>definitelyString;

// Positive: non-null assertion on a value the Checker has already
// proven non-nullable strips nothing.
// expect: typescript/no-unnecessary-type-assertion error
const c = definitelyString!;

// Negative: stripping `undefined` actually narrows the type.
const d = maybeString as string;

// Negative: `as const` produces a strictly narrower literal type and is
// covered by `typescript/prefer-as-const`.
const e = literal as const;

JSON.stringify({ a, b, c, d, e });

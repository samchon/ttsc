declare const maybeUndefined: string | undefined;
declare const maybeNull: number | null;
declare const maybeNullOrUndefined: boolean | null | undefined;
declare const literalUnion: "a" | "b" | undefined;
declare const definitelyDefined: string;
declare const widerUnion: string | number | undefined;

// Positive: `string | undefined` asserted back to `string`.
// expect: typescript/non-nullable-type-assertion-style error
const a = maybeUndefined as string;

// Positive: `number | null` asserted back to `number`.
// expect: typescript/non-nullable-type-assertion-style error
const b = maybeNull as number;

// Positive: `boolean | null | undefined` asserted back to `boolean`.
// expect: typescript/non-nullable-type-assertion-style error
const c = maybeNullOrUndefined as boolean;

// Positive: literal union loses its `undefined` constituent only.
// expect: typescript/non-nullable-type-assertion-style error
const d = literalUnion as "a" | "b";

// Negative: source type is already non-nullable; no `!` rewrite applies.
const e = definitelyDefined as string;

// Negative: assertion narrows to a strict subset (drops `number` in
// addition to `undefined`), so `!` would lose the type narrowing.
const f = widerUnion as string;

JSON.stringify({ a, b, c, d, e, f });

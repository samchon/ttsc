declare const obj: { id: number };
declare const maybe: string | null;
declare const label: string;
declare const count: number;

// expect: typescript/restrict-template-expressions error
const a = `id=${obj}`;
// expect: typescript/restrict-template-expressions error
const b = `value=${null}`;
// expect: typescript/restrict-template-expressions error
const c = `value=${undefined}`;
// expect: typescript/restrict-template-expressions error
const d = `value=${maybe}`;

// String / number / boolean / bigint interpolations are fine.
const e = `${label}-${count}-${true}-${1n}`;

JSON.stringify({ a, b, c, d, e });

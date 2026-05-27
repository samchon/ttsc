// expect: typescript/no-restricted-types error
const a: Object = {};

// expect: typescript/no-restricted-types error
const b: Function = () => undefined;

// expect: typescript/no-restricted-types error
const c: Number = 1 as never;

// expect: typescript/no-restricted-types error
const d: String = "" as never;

// expect: typescript/no-restricted-types error
const e: Boolean = true as never;

// Lowercase primitives — never fire.
const ok1: number = 1;
const ok2: string = "";
const ok3: boolean = true;
const ok4: object = {};

JSON.stringify({ a, b, c, d, e, ok1, ok2, ok3, ok4 });

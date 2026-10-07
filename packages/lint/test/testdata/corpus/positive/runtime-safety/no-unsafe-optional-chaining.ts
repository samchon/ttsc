declare const obj: { foo?: { bar: number } } | undefined;
// expect: no-unsafe-optional-chaining error
const x = (obj?.foo).bar;
JSON.stringify(x);

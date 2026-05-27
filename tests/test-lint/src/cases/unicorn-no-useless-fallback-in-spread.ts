declare const x: { a: number } | null;
// expect: unicorn/no-useless-fallback-in-spread error
const o = { ...(x ?? {}) };
void o;

declare const source: { x: number };
// expect: prefer-object-spread error
const merged = Object.assign({}, source);
JSON.stringify(merged);

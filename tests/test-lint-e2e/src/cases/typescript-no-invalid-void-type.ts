// Positive: void in a union with a non-Promise generic.
// expect: typescript/no-invalid-void-type error
type Result = string | void;

// Positive: void as a property type.
interface Container {
  // expect: typescript/no-invalid-void-type error
  value: void;
}

// Positive: void in a non-allow-listed generic.
type Box<T> = { value: T };
// expect: typescript/no-invalid-void-type error
type VoidBox = Box<void>;

// Negative: void as a function return type.
function noop(): void {
  JSON.stringify("nothing");
}

// Negative: void inside Promise<…>.
async function nothing(): Promise<void> {
  JSON.stringify("nothing");
}

// Negative: void as the unary expression operator — not a type position.
const ignored = void 0;

JSON.stringify({ Result: null, Container: null, VoidBox: null, noop, nothing, ignored });

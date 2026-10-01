declare function syncWork(): number;
declare function getPromise(): Promise<number>;

// Positive: function declaration whose return type is `Promise<T>`
// is not declared `async` — a synchronous `throw` here would escape
// the Promise rejection channel.
// expect: typescript/promise-function-async error
function makePromise(): Promise<number> {
  return getPromise();
}

// Positive: arrow function returning Promise without `async`.
// expect: typescript/promise-function-async error
const arrowPromise = (): Promise<number> => getPromise();

// Positive: function expression returning Promise without `async`.
// expect: typescript/promise-function-async error
const exprPromise = function (): Promise<number> {
  return getPromise();
};

// Positive: class method returning Promise without `async`.
class Service {
  // expect: typescript/promise-function-async error
  fetch(): Promise<number> {
    return getPromise();
  }
}

// Negative: function is already `async`.
async function alreadyAsync(): Promise<number> {
  return getPromise();
}

// Negative: synchronous function — rule does not apply.
function syncFunction(): number {
  return syncWork();
}

// Negative: abstract method has no body — `async` cannot apply.
abstract class Base {
  abstract run(): Promise<number>;
}

// Negative: overload signatures have no body — only the implementation
// signature can be `async`, which it already is.
async function overloaded(x: number): Promise<number>;
async function overloaded(x: string): Promise<string>;
async function overloaded(x: number | string): Promise<number | string> {
  return x;
}

JSON.stringify({
  makePromise,
  arrowPromise,
  exprPromise,
  Service,
  alreadyAsync,
  syncFunction,
  Base,
  overloaded,
});

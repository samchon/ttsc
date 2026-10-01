declare const stringValue: string;
declare const numberValue: number;

// Positive: throw a string literal.
function throwStringLiteral(): never {
  // expect: typescript/only-throw-error error
  throw "boom";
}

// Positive: throw a number literal.
function throwNumberLiteral(): never {
  // expect: typescript/only-throw-error error
  throw 42;
}

// Positive: throw a value typed as `string`.
function throwStringTyped(): never {
  // expect: typescript/only-throw-error error
  throw stringValue;
}

// Positive: throw a value typed as `number`.
function throwNumberTyped(): never {
  // expect: typescript/only-throw-error error
  throw numberValue;
}

// Positive: throw `null`.
function throwNull(): never {
  // expect: typescript/only-throw-error error
  throw null;
}

// Positive: throw `undefined`.
function throwUndefined(): never {
  // expect: typescript/only-throw-error error
  throw undefined;
}

// Negative: throw a real Error instance.
function throwError(): never {
  throw new Error("boom");
}

// Negative: throw an Error subclass instance.
class CustomError extends Error {}
function throwCustomError(): never {
  throw new CustomError("boom");
}

// Negative: re-throw a caught `unknown`.
function reThrow(): never {
  try {
    throw new Error("boom");
  } catch (err) {
    throw err;
  }
}

JSON.stringify({
  throwStringLiteral,
  throwNumberLiteral,
  throwStringTyped,
  throwNumberTyped,
  throwNull,
  throwUndefined,
  throwError,
  throwCustomError,
  CustomError,
  reThrow,
});

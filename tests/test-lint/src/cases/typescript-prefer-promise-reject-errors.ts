declare const stringValue: string;
declare const numberValue: number;

// Positive: Promise.reject with a string literal.
function rejectStringLiteral(): Promise<never> {
  // expect: typescript/prefer-promise-reject-errors error
  return Promise.reject("boom");
}

// Positive: Promise.reject with a number literal.
function rejectNumberLiteral(): Promise<never> {
  // expect: typescript/prefer-promise-reject-errors error
  return Promise.reject(42);
}

// Positive: Promise.reject with a value typed as `string`.
function rejectStringTyped(): Promise<never> {
  // expect: typescript/prefer-promise-reject-errors error
  return Promise.reject(stringValue);
}

// Positive: Promise.reject with a value typed as `number`.
function rejectNumberTyped(): Promise<never> {
  // expect: typescript/prefer-promise-reject-errors error
  return Promise.reject(numberValue);
}

// Positive: Promise.reject with `null`.
function rejectNull(): Promise<never> {
  // expect: typescript/prefer-promise-reject-errors error
  return Promise.reject(null);
}

// Positive: Promise.reject with `undefined`.
function rejectUndefined(): Promise<never> {
  // expect: typescript/prefer-promise-reject-errors error
  return Promise.reject(undefined);
}

// Positive: reject inside a `new Promise` executor with a primitive
// argument.
function rejectInExecutor(): Promise<number> {
  return new Promise<number>((_resolve, reject) => {
    // expect: typescript/prefer-promise-reject-errors error
    reject("boom");
  });
}

// Negative: Promise.reject with a real Error instance.
function rejectError(): Promise<never> {
  return Promise.reject(new Error("boom"));
}

// Negative: Promise.reject with an Error subclass instance.
class CustomError extends Error {}
function rejectCustomError(): Promise<never> {
  return Promise.reject(new CustomError("boom"));
}

// Negative: reject inside a `new Promise` executor with an Error.
function rejectErrorInExecutor(): Promise<number> {
  return new Promise<number>((_resolve, reject) => {
    reject(new Error("boom"));
  });
}

// Negative: re-reject a caught `unknown` (matches the
// allowThrowingUnknown default).
function reReject(): Promise<never> {
  try {
    throw new Error("boom");
  } catch (err) {
    return Promise.reject(err);
  }
}

JSON.stringify({
  rejectStringLiteral,
  rejectNumberLiteral,
  rejectStringTyped,
  rejectNumberTyped,
  rejectNull,
  rejectUndefined,
  rejectInExecutor,
  rejectError,
  rejectCustomError,
  CustomError,
  rejectErrorInExecutor,
  reReject,
});

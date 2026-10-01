declare function getPromise(): Promise<number>;
declare function sideEffect(): void;

// Positive: `.catch` callback with no annotation.
async function catchNoAnnotation(): Promise<void> {
  // expect: typescript/use-unknown-in-catch-callback-variable error
  getPromise().catch((err) => {
    sideEffect();
  });
}

// Positive: `.catch` callback annotated as `any`.
async function catchAnyAnnotation(): Promise<void> {
  // expect: typescript/use-unknown-in-catch-callback-variable error
  getPromise().catch((err: any) => {
    sideEffect();
  });
}

// Positive: `.catch` callback annotated as `Error`.
async function catchErrorAnnotation(): Promise<void> {
  // expect: typescript/use-unknown-in-catch-callback-variable error
  getPromise().catch((err: Error) => {
    sideEffect();
  });
}

// Positive: `.then` second arg with no annotation.
async function thenSecondArgNoAnnotation(): Promise<void> {
  // expect: typescript/use-unknown-in-catch-callback-variable error
  getPromise().then((value) => sideEffect(), (err) => sideEffect());
}

// Negative: `.catch` callback annotated `unknown` — compliant.
async function catchUnknown(): Promise<void> {
  getPromise().catch((err: unknown) => {
    sideEffect();
  });
}

// Negative: `.then` with only the fulfillment handler — rule does not apply.
async function thenSingleArg(): Promise<void> {
  getPromise().then((value) => sideEffect());
}

// Negative: method named `catch` on a non-Promise object — rule does not
// apply because the receiver is not Promise-typed.
const fakeReceiver = {
  catch(handler: (err: number) => void): void {
    handler(0);
  },
};
fakeReceiver.catch((err) => sideEffect());

JSON.stringify({
  catchNoAnnotation,
  catchAnyAnnotation,
  catchErrorAnnotation,
  thenSecondArgNoAnnotation,
  catchUnknown,
  thenSingleArg,
  fakeReceiver,
});

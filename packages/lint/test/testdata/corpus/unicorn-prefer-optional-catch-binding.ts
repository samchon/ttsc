declare function f(): void;
declare function g(): void;
declare function log(value: unknown): void;

// A binding named `err` is unused: the dropped two-name allow-list used to
// miss every name other than `e`/`error`.
try {
  f();
  // expect: unicorn/prefer-optional-catch-binding error
} catch (err) {
  g();
}

// A binding named `exception` is also outside the old allow-list.
try {
  f();
  // expect: unicorn/prefer-optional-catch-binding error
} catch (exception) {
  g();
}

// A comment that spells the binding name is not a reference; the old raw-text
// scan treated it as a use and stayed silent.
try {
  f();
  // expect: unicorn/prefer-optional-catch-binding error
} catch (error) {
  // swallow the error
  g();
}

// A string literal containing the binding name is not a reference either.
try {
  f();
  // expect: unicorn/prefer-optional-catch-binding error
} catch (error) {
  g();
  log("error");
}

// The canonical `e` case from the original fixture still reports.
try {
  f();
  // expect: unicorn/prefer-optional-catch-binding error
} catch (e) {
  g();
}

// A nested shadow rebinds `error`; the inner references resolve to the inner
// declaration, so the catch binding itself stays unused and is reported.
try {
  f();
  // expect: unicorn/prefer-optional-catch-binding error
} catch (error) {
  {
    const error = 1;
    log(error);
  }
}

// Genuine use: `log(err)` references the binding, so nothing is reported.
try {
  f();
} catch (err) {
  log(err);
}

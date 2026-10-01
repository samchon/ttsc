function boom(): never {
  // expect: functional/no-throw-statements error
  throw new Error("boom");
}

JSON.stringify(boom);

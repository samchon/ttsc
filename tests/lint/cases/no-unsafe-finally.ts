function f() {
  try {
    throw new Error("x");
  } finally {
    // expect: no-unsafe-finally error
    return 1;
  }
}
JSON.stringify(f);
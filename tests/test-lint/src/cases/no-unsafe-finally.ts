function f() {
  try {
    throw new Error("x");
  } finally {
    // expect: noUnsafeFinally error
    return 1;
  }
}
JSON.stringify(f);

function f() {
  try {
    return 1;
    // expect: noUselessCatch error
  } catch (e) {
    throw e;
  }
}
JSON.stringify(f);

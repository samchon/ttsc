function f() {
  try {
    return 1;
  // expect: no-useless-catch error
  } catch (e) {
    throw e;
  }
}
JSON.stringify(f);

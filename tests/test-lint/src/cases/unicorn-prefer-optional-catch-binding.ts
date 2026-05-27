try {
  throw new Error("x");
  // expect: unicorn/prefer-optional-catch-binding error
} catch (e) {
  void 0;
}

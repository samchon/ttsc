try {
  throw new Error("x");
} catch (e) {
  // expect: no-ex-assign error
  e = "boom";
  console.log(e);
}

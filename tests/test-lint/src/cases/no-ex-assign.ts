try {
  throw new Error("x");
} catch (e) {
  // expect: noExAssign error
  e = "boom";
  console.log(e);
}

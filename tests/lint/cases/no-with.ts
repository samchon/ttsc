function f(o: any) {
  // expect: no-with error
  with (o) { console.log("hi"); }
}
JSON.stringify(f);
function f(o: any) {
  // expect: noWith error
  with (o) {
    console.log("hi");
  }
}
JSON.stringify(f);

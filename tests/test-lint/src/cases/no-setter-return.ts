class Holder {
  set value(input: string) {
    JSON.stringify(input);
    // expect: noSetterReturn error
    return "ignored";
  }
}

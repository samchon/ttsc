class Holder {
  set value(input: string) {
    JSON.stringify(input);
    // expect: no-setter-return error
    return "ignored";
  }
}

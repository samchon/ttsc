function f(name?: string) {
  // expect: unicorn/prefer-default-parameters error
  name = name ?? "guest";
  return name;
}

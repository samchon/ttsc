class C {
  get value() {
    // expect: unicorn/no-accessor-recursion error
    return this.value;
  }
}
void C;

class Foo {
  // expect: typescript/prefer-readonly error
  private a = 1;

  // expect: typescript/prefer-readonly error
  #b = 2;

  // Already readonly — never fires.
  private readonly c = 3;

  // No initializer — the AST-only baseline cannot prove it is only
  // assigned in the constructor, so the rule stays silent.
  private d: number;

  // Not private — outside callers may write to it.
  e = 5;

  constructor() {
    this.d = 4;
  }
}

JSON.stringify(new Foo());

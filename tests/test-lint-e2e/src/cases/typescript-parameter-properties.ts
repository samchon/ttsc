// AST-only fixture for typescript/parameter-properties.
//
// Parameter properties — a constructor parameter prefixed with
// `public`, `private`, `protected`, `readonly`, or `override` —
// declare a class field implicitly. The rule's default policy
// (`prefer: "class-property"`) reports every such parameter so the
// class shape stays visible from the member list instead of being
// hidden in the constructor parameter list.

class ParameterShorthand {
  constructor(
    // expect: typescript/parameter-properties error
    public name: string,
    // expect: typescript/parameter-properties error
    private readonly id: number,
    // expect: typescript/parameter-properties error
    protected count: number,
  ) {
    JSON.stringify({ name, id, count });
  }
}

// Negative: plain field declarations + a plain constructor parameter.
// This is the shape the rule asks for.
class ExplicitFields {
  public name: string;
  private readonly id: number;
  protected count: number;
  constructor(name: string, id: number, count: number) {
    this.name = name;
    this.id = id;
    this.count = count;
  }
}

JSON.stringify({ ParameterShorthand, ExplicitFields });

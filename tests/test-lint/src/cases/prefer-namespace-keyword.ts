// expect: preferNamespaceKeyword error
module Foo {
  export const x = 1;
}
JSON.stringify(Foo.x);

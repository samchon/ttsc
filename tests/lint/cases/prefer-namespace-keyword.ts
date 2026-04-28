// expect: prefer-namespace-keyword error
module Foo { export const x = 1; }
JSON.stringify(Foo.x);
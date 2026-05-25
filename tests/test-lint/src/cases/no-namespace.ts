// expect: noNamespace error
namespace Foo {
  export const x = 1;
}
JSON.stringify(Foo.x);

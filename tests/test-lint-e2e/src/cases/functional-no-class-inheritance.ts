class Base {}

// expect: functional/no-class-inheritance error
class Derived extends Base {}

JSON.stringify({ Base, Derived });

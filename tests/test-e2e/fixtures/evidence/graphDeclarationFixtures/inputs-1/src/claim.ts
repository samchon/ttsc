import type { Orders, Service, arrow, declared, expression } from "./contracts.js";

/**
 * @evidence {@link declared} Covers the exported function declaration.
 * @evidence {@link arrow} Covers the exported arrow function.
 * @evidence {@link expression} Covers the exported function expression.
 * @evidence {@link Service.prototype.run} Covers the public instance method.
 * @evidence {@link Service.prototype.execute} Covers the public function field.
 * @evidence {@link Service.prototype.callback} Covers the direct function-typed field.
 * @evidence {@link Service.create} Covers the public static method.
 * @evidence {@link Service.restore} Covers the public static function field.
 * @evidence {@link Service.provider} Covers the static function-typed field.
 * @evidence {@link Orders.open} Covers the namespace function.
 * @evidence {@link Orders.close} Covers the namespace arrow function.
 */
export interface IClaim {}

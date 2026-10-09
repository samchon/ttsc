let value = "untouched";
function consumerEffect(): void { value = "kept"; }
consumerEffect();
export { value };

let consumer = "untouched";
let own = "untouched";
function consumerEffect(): void { consumer = "kept"; }
function ownEffect(): void { own = "kept"; }
consumerEffect();
ownEffect();
export const token = {};
export { consumer, own };

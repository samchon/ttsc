declare const cy: any;
// expect: cypress/no-and error
cy.get("button").and("be.visible");

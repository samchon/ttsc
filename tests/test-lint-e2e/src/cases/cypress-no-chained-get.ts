declare const cy: any;
// expect: cypress/no-chained-get error
cy.get("form").get("button");

# Actors, Authentication, and Permissions

This document defines the platform identities, credential lifecycles, global administrator grades, and authority boundaries. Customer and seller identities are separate because their establishment, restrictions, and closure effects differ. Administrator authority is a grade that either identity may acquire; it is not a third credential account. A shop is owned by a seller and is not a tenant or membership organization.

## REQ-CUSTOMER-IDENTITY Customer identity and credential lifecycle

Every shopping capability begins with a registered customer account; there is no anonymous browsing path. Email and password identify the customer, while profile details, saved destinations, purchases, and authored reviews follow their own business rules.

An authenticated relationship may continue across ordinary session renewal and may be ended for one session or for all sessions. These choices complete the access lifecycle without imposing a fixed session duration. Closing the account instead ends identity authority: personal working data is removed, transaction history remains, and published reviews lose personal attribution.

### REQ-CUSTOMER-IDENTITY-1 Register a customer account

A person may register a customer account by supplying an email address and password. The email becomes the login identifier, and successful registration creates an active customer identity with authority over only its own customer records.

Registration also starts an authenticated customer session, allowing the customer to create a profile and saved shipping addresses. An email already used by another customer account, or missing credential input, is refused under the registration policies in REQ-CREDENTIAL-POLICIES.

### REQ-CUSTOMER-IDENTITY-2 Log in as a customer

A registered customer may log in with the account email and password. Matching credentials for an eligible account produce a session that identifies the customer for all later ownership checks and enables the customer capabilities allowed by the account's current state.

Invalid credentials, deletion, or an administrator ban prevents login. A failed attempt does not reveal whether the email or the password was wrong.

### REQ-CUSTOMER-IDENTITY-3 Continue a customer session

A customer presenting a valid renewable session may continue as the same customer without repeating email-and-password login. Continuation preserves the identity's ownership and permission scope and never creates another customer identity.

A revoked session, an invalid continuation attempt, or an account that has become banned or deleted cannot be continued.

### REQ-CUSTOMER-IDENTITY-4 Log out the current customer session

An authenticated customer may log out the current session. That session can no longer authorize customer actions, while other active sessions for the same account remain usable.

Logout changes no profile, address, order, review, wishlist, or cart information. Repeating logout after the current session is already absent has the same signed-out result.

### REQ-CUSTOMER-IDENTITY-5 Log out every customer session

An authenticated customer may revoke all sessions belonging to the customer identity. The requesting session is included, and no previously issued customer session remains authorized afterward.

The command leaves credentials and business records unchanged. It has a well-defined successful outcome even when the requesting session is the only active one.

### REQ-CUSTOMER-IDENTITY-6 Change the customer password

An authenticated customer may replace the password by supplying the correct current password and a new password. After the change, the old password no longer authenticates and the new password authenticates the same customer identity.

Other existing sessions are revoked so a previously authorized context cannot continue after the credential changes. The current session remains active, and profile and commerce records are unaffected. Incorrect current-password proof or a missing new password is refused.

### REQ-CUSTOMER-IDENTITY-7 Recover customer access

A customer who cannot use the current password may recover access through an ownership challenge delivered to the registered email and then choose a new password. Successful recovery applies only to the identity controlling that email, replaces the forgotten credential, and restores login eligibility.

All sessions issued before recovery are revoked. An invalid, expired, or account-mismatched challenge cannot complete recovery, and recovery never changes the customer's profile, addresses, orders, or reviews.

### REQ-CUSTOMER-IDENTITY-8 Delete a customer account

An authenticated customer may permanently close the acting account after confirming the current password. If that identity is the final active super administrator, closure is refused so administrator governance remains reachable. Otherwise, closure immediately terminates every customer session, removes the credentials, profile, saved addresses, wishlist, and cart, and prevents later login or reactivation.

Orders, order items, shipments, cancellation and refund requests, and purchase snapshots remain available for seller records and legal continuity. Published reviews also remain, but their author is displayed as `deleted user` rather than by the former customer's profile. Incorrect current-password confirmation or loss of the last active super administrator refuses deletion.

## REQ-SELLER-IDENTITY Seller identity and credential lifecycle

Seller registration establishes a merchant identity, but it does not itself grant selling authority. Approval, suspension, and ban remain separate account conditions: approval governs whether the merchant may sell, suspension freezes catalog activity while existing orders continue, and ban governs login.

Eligible sellers can continue or terminate authenticated sessions and can replace or recover credentials without changing shop or order state. Permanent closure has a stricter commercial boundary: paid or shipped items and unresolved customer requests must be cleared first, after which listings disappear while purchase evidence remains.

### REQ-SELLER-IDENTITY-1 Register a seller account

A person may register a seller account with an email address and password. Successful registration creates a seller identity in `pending` approval state, uses the email as its login identifier, and starts an authenticated seller session.

While pending, the seller may inspect approval status and complete the shop profile, but may not create or edit products. A seller email already in use, or missing credential input, is refused under REQ-CREDENTIAL-POLICIES.

### REQ-SELLER-IDENTITY-2 Log in as a seller

A seller may log in with the account email and password. Matching credentials issue a session that identifies the seller for ownership checks.

Pending, rejected, approved, and suspended sellers may authenticate so they can inspect status or meet existing-order duties; those states still govern which selling commands are allowed. Invalid credentials, a ban, or deletion prevents login, and failure does not reveal which credential value was wrong.

### REQ-SELLER-IDENTITY-3 Continue a seller session

A valid renewable seller session may continue as the same seller without another password login. The renewed context preserves shop ownership and every current approval, suspension, or other account-state restriction.

Continuation never creates another seller identity. Invalid, revoked, banned, or deleted contexts are refused.

### REQ-SELLER-IDENTITY-4 Log out the current seller session

An authenticated seller may end the current session. The ended session loses authority, while other active sessions for the same seller remain usable.

Logout changes no seller profile, product, inventory movement, shipment, order item, or request. Repeating logout after the session is absent has the same signed-out result.

### REQ-SELLER-IDENTITY-5 Log out every seller session

An authenticated seller may revoke every session belonging to the seller identity, including the session making the request. No previously issued seller session remains authorized afterward.

Credentials, approval state, shop information, merchandise, and commercial history remain unchanged. The command also succeeds when the requesting context is the only active session.

### REQ-SELLER-IDENTITY-6 Change the seller password

An authenticated seller may replace the password by supplying the correct current password and a new password. The old password stops authenticating and the new password authenticates the same seller identity.

Other sessions are revoked, while the current session remains active. Approval, suspension, shop, merchandise, and order state are unaffected. Incorrect current proof or a missing new password is refused.

### REQ-SELLER-IDENTITY-7 Recover seller access

A seller who cannot use the current password may recover access through an ownership challenge delivered to the registered email and then choose a new password. Successful recovery replaces the forgotten credential for the same seller identity.

Every session issued before recovery is revoked. Recovery changes no approval, suspension, shop, or commerce record. An invalid, expired, or mismatched challenge—and a banned or deleted account—cannot complete recovery.

### REQ-SELLER-IDENTITY-8 Delete a seller account

An authenticated seller may permanently close the acting account after confirming the current password, but only when no seller-owned order item remains `paid` or `shipped`, no cancellation or refund request remains `pending`, and closure would not remove the final active super administrator.

Successful closure terminates all seller sessions and removes the seller's live products from listings together with their variants and inventory histories. Past orders, snapshots, and the shop name captured on past order items remain available. The identity cannot later log in or be reactivated.

Incorrect password proof, any unresolved commercial blocker, or loss of the last active super administrator leaves the account active and refuses deletion.

## REQ-ADMIN-AUTHORITY Administrator grade authority

Administrator authority is a platform-wide grade added to an existing customer or seller identity; approval does not create another set of credentials or discard the applicant's shopping or selling history. Regular administrators oversee sellers, categories, products, orders, and user accounts across the platform.

Super administrators include every regular permission and additionally govern administrator applications and grades. Application approval adds the regular grade, promotion adds the super grade, and demotion removes only the super grade. This exact grant-and-revoke model preserves regular oversight after demotion and protects the acting super administrator from self-demotion.

### REQ-ADMIN-AUTHORITY-1 Regular administrator authority

A customer or seller whose administrator application is approved holds the `regularAdministrator` grade in addition to the underlying identity. The grade is platform-wide and authorizes the seller approval and suspension, category curation, product oversight, order intervention, and customer and seller account oversight named in this specification.

Regular authority does not include deciding administrator applications or changing administrator grades. Every oversight action also remains subject to the target-state and business rules of its own requirement.

### REQ-ADMIN-AUTHORITY-2 Super administrator authority

The `superAdministrator` grade includes every regular administrator permission. It additionally authorizes inspection and decision of pending administrator applications, promotion of regular administrators, and demotion of other super administrators.

The holder remains the same customer or seller credential identity and retains regular oversight while the super grade is active. The definition itself has no transition refusal; each application or grade command states its own eligible target and state.

### REQ-ADMIN-AUTHORITY-3 Grant regular administrator authority

When a super administrator approves a pending administrator application, the applicant immediately receives the `regularAdministrator` grade. The approved application becomes final, and the applicant keeps the same customer or seller credentials, records, and history.

Approval does not grant the `superAdministrator` grade. A request that is not pending, or a decision maker without super authority, cannot confer the regular grade.

### REQ-ADMIN-AUTHORITY-4 Promote an administrator

A super administrator may promote a current regular administrator by granting the `superAdministrator` grade. The target keeps regular authority, retains the same customer or seller identity, and immediately gains application-decision and administrator-grade authority.

Promotion is refused when the actor lacks super authority or the target is not a current regular administrator.

### REQ-ADMIN-AUTHORITY-5 Demote another super administrator

A super administrator may demote another current super administrator by removing the target's `superAdministrator` grade. The target retains `regularAdministrator`, continues ordinary platform oversight, and keeps the underlying customer or seller identity and history.

Demotion is refused when the actor lacks super authority or the target is not another current super administrator.

### REQ-ADMIN-AUTHORITY-6 Prevent self-demotion

A super administrator cannot use the demotion command on the same identity making the request. The attempt removes no grade, and the actor remains a super administrator.

Another eligible super administrator may still demote that holder. The refusal therefore protects the command boundary without making the grade permanent.

## REQ-ACCESS-BOUNDARIES Identity and permission boundaries

Every product feature requires a registered, authenticated customer or seller identity. Ownership then narrows ordinary authority: customers control their own shopping records, sellers control their own shop and fulfillment records, and administrator grades provide the explicitly named platform-wide exceptions.

Seller restrictions are intentionally layered. Suspension hides merchandise and freezes catalog change while allowing existing-order duties to continue; ban prevents authentication. Administrator authority is likewise layered by grade and never bypasses a command's target-state, history-preservation, or self-target rule.

### REQ-ACCESS-BOUNDARIES-1 Require registration for every feature

There is no guest browsing or anonymous commerce. Product search, category browsing, product and seller-profile views, wishlists, carts, checkout, order history, requests, reviews, seller workflows, and administrator workflows all require an authenticated customer or seller identity.

Every unauthenticated attempt is refused without exposing protected customer, seller, order, or snapshot information. The caller must register or log in before using the feature.

### REQ-ACCESS-BOUNDARIES-2 Limit customer-owned activity

A customer may inspect and change only the acting customer's profile, saved addresses, wishlist, cart, orders, tracking, cancellation and refund requests, and authored reviews.

The purchasing customer relationship is required for order, shipment, cancellation, refund, and purchase-review actions. Another customer receives no access. An eligible administrator's inspection or force action is the only platform-wide exception named by this product.

### REQ-ACCESS-BOUNDARIES-3 Limit seller-owned activity

A seller may act only on the seller's profile, products, variants, images, inventory movements, order items, shipments, and cancellation or refund requests. Seller dashboards and operational lists are restricted to the same ownership scope.

A shipment or request decision cannot include another seller's order item, and one seller cannot change another seller's catalog. Eligible administrator oversight is the only platform-wide exception.

### REQ-ACCESS-BOUNDARIES-4 Preserve duties during seller suspension

When an administrator suspends an approved seller, the seller's products disappear from search and category results and cannot be purchased. The seller cannot create products or edit products, variants, or images while suspended.

The suspended seller may still inspect and ship existing paid items and may decide existing cancellation or refund requests. Unsuspension restores the approved seller's ordinary catalog visibility and change authority. Any new or mutating catalog command during suspension is refused.

### REQ-ACCESS-BOUNDARIES-5 Block login for banned accounts

A banned customer or seller cannot log in or continue a previously issued session, even with valid credentials. The ban immediately removes session authority without deleting orders, snapshots, reviews, or seller obligations that must remain.

Administrator unban restores authentication eligibility unless deletion or another terminal account condition still prevents it.

### REQ-ACCESS-BOUNDARIES-6 Apply platform-wide administrator oversight

An eligible regular administrator may inspect and moderate seller approvals, categories, products and product snapshots, orders, customer accounts, and seller accounts across owner boundaries. Super administrators receive those regular powers plus administrator-application and grade governance.

Only the commands explicitly assigned to the holder's grade are available. Each action still preserves immutable history and obeys its target-state, force-resolution, and self-target restrictions; an identity without the required grade is refused.

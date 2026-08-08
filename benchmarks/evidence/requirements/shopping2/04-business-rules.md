# Business Rules

This document defines validations, allowed values, thresholds, calculations, conflicts, exceptions, and refusals that constrain the platform's actor-visible operations. Identity and permission ownership remain in the actor specification, business concepts and lifecycles remain in the domain model, and callable journeys remain in the functional requirements.

## REQ-CREDENTIAL-POLICIES Registration and credential policies

Customer and seller credentials occupy separate account namespaces. Within either namespace, a canonical email resolves to one current identity; across namespaces, the same person may use one email for a customer identity and a seller identity.

Password change proves possession of the current credential, while email-based recovery handles its loss. Ban and deletion are enforced against both new login and previously issued sessions.

### REQ-CREDENTIAL-POLICIES-1 Keep one identity per canonical email and account type

Customer email is unique among current customers, and seller email is unique among current sellers. Comparison trims surrounding whitespace and ignores letter case; the stored login email may retain its display form.

The same canonical email may identify one customer and one seller because those are distinct identities with separate credentials, profiles, sessions, and permissions. This invariant itself has no command refusal; duplicate registration owns that result.

### REQ-CREDENTIAL-POLICIES-2 Refuse duplicate registration

Registration canonicalizes the supplied email and compares it within the requested account type. A collision with a current identity is refused without changing or revealing that account's credentials or profile.

A customer collision does not consult sellers, and a seller collision does not consult customers. Because permanent deletion removes credentials, a former email may be registered again afterward; the new identity does not inherit retained orders, reviews, snapshots, or authority from the deleted identity.

### REQ-CREDENTIAL-POLICIES-3 Require current-password proof for password change

An in-session password change succeeds only when the supplied current password matches the acting customer or seller identity. The account, profile, commerce records, and current session continue under the new password, while other sessions are revoked.

Missing or incorrect proof changes neither the password nor any session. A person who cannot provide the current password must use the separate registered-email recovery path.

### REQ-CREDENTIAL-POLICIES-4 Block unavailable identities

A banned or deleted customer or seller cannot log in or continue a previously issued session, even with correct credentials. Every session issued before either restriction is unusable.

Unban restores future login eligibility for the same non-deleted identity but never revives an old session. Permanent deletion cannot be reversed.

## REQ-ADDRESS-POLICIES Shipping address policies

A saved destination is a complete customer-owned set of recipient and postal values. Ownership governs every live read and mutation, while checkout copies one current owned address into a commercial record that later live changes cannot rewrite.

Each customer may have zero or one default. Selecting a default transfers the designation; removing it deliberately leaves none rather than guessing which remaining address the customer prefers.

### REQ-ADDRESS-POLICIES-1 Require a complete shipping address

Adding or editing an address requires nonempty recipient name, phone number, street address, city, state or province, postal code, and country. Whitespace-only input is missing, and one field cannot stand in for another.

All eight values belong to the same saved address. State or province remains required even where local terminology differs; the platform does not impose an unstated universal phone or postal-code format.

### REQ-ADDRESS-POLICIES-2 Enforce address ownership

An address may be listed, viewed, edited, deleted, or made default only by its customer owner. Knowing another address identifier grants no access, and foreign addresses never appear in the acting customer's list.

A nonexistent or foreign-owned address, or an unavailable customer identity, is refused without changing either customer's address or default. Administrator order oversight reads an order's immutable copy instead of taking ownership of the former live address.

### REQ-ADDRESS-POLICIES-3 Keep at most one default address

Setting an owned address as default makes it the customer's only default and removes the designation from any previous default in the same change. Selecting the current default again leaves that single designation in place.

No other customer's default, address fields, or prior order copy changes. A nonexistent or foreign target is refused and leaves the existing default intact.

### REQ-ADDRESS-POLICIES-4 Clear a removed default without automatic replacement

Deleting the current default removes that live address and leaves the customer with no default until another is explicitly selected. No remaining address is promoted automatically, although the customer may still choose one explicitly at checkout.

Deleting a nondefault address leaves the existing default unchanged. Every prior order keeps its immutable purchase-time shipping address. A nonexistent or foreign address is refused.

### REQ-ADDRESS-POLICIES-5 Use only a current owned address at checkout

Checkout accepts one complete retained address owned by the acting customer. Asking for the default requires that a default currently exist; explicit selection may use any retained owned address.

The selected values are copied into the checkout summary. If the live address changes before placement, the customer must review the refreshed copy. Successful order creation fixes the order's address permanently. A missing default, deleted, foreign, or incomplete address is refused.

## REQ-SELLER-ACCOUNT-POLICIES Seller approval, restriction, and deletion policies

Approval, suspension, and ban govern different boundaries. Approval decides whether the seller may begin selling, suspension hides merchandise and freezes catalog changes while preserving authenticated existing-order duties, and ban prevents login.

Permanent deletion is stricter than any temporary restriction. It waits for active fulfillment and unresolved customer requests to end before removing the live seller identity and listings.

### REQ-SELLER-ACCOUNT-POLICIES-1 Require approval before selling

Registration starts the seller in `pending`; neither `pending` nor `rejected` permits product publication, product, variant, or image mutation, or purchase of that seller's products. A new request after rejection returns to `pending` and grants no interim authority.

`approved` enables ordinary selling only when suspension and ban do not independently block it. Every selling operation is refused until that complete condition is true.

### REQ-SELLER-ACCOUNT-POLICIES-2 Require and retain a seller rejection reason

Rejecting a pending seller application requires a nonempty text reason. The reason stays with that specific rejected request, together with deciding administrator and decision time, and the seller can inspect it after login.

A later application does not overwrite the earlier reason. Missing or whitespace-only reason refuses the decision and leaves the request `pending`.

### REQ-SELLER-ACCOUNT-POLICIES-3 Separate suspension from fulfillment duties

Suspension hides the seller's products and makes them unpurchasable. Product, variant, and image creation or editing is refused until unsuspension.

The seller can still authenticate unless separately banned, view and ship existing paid items, and approve or reject pending cancellation and refund requests. Seller-owned restock and loss adjustments also remain available as inventory-ledger movements rather than product edits, but they cannot make merchandise purchasable during suspension.

Orders, shipments, inventory history, and snapshots remain intact. Unsuspension restores catalog eligibility only to the extent allowed by approval, ban, product, variant, and stock state.

### REQ-SELLER-ACCOUNT-POLICIES-4 Block seller deletion during active fulfillment

Seller deletion requires zero retained seller-attributed items in `paid` or `shipped`. The check crosses every product and variant historically attributed to the seller; later catalog deletion does not hide a blocker.

`delivered`, `cancelled`, and `refunded` do not block through item status alone. Eligibility is rechecked when closure commits so a concurrent purchase or shipment cannot bypass it. Any paid or shipped item refuses deletion and leaves account and listings unchanged.

### REQ-SELLER-ACCOUNT-POLICIES-5 Block seller deletion during unresolved requests

Seller deletion also requires zero `pending` cancellation or refund requests for seller-attributed order items. A pending cancellation blocks while its item is paid, and a pending refund blocks while its item is delivered.

Approved and rejected requests do not block through request state alone. Eligibility is rechecked at closure commit across retained order-item attribution, including items whose live product was deleted. Any matching pending request refuses deletion and leaves account and listings unchanged.

## REQ-CATEGORY-POLICIES Category hierarchy and curation policies

Administrators curate the category taxonomy; customers and sellers consume it through browse and product selection. The hierarchy has exactly two possible levels: a top-level category or one direct child.

Products may use either live level. Category retirement removes a browsing classification rather than the merchandise or its historical evidence.

### REQ-CATEGORY-POLICIES-1 Reserve category curation for administrators

Only a current regular or super administrator may create, edit, or delete a category. Customers and sellers can browse categories, but those identities alone cannot curate them.

Creation sets name, description, and an optional top-level parent. Edit changes name or description without changing level or parent. Deletion applies child handling and product uncategorization together. A non-administrator is refused without changing taxonomy or products.

### REQ-CATEGORY-POLICIES-2 Limit category depth to two levels

A category without a parent is top-level. Supplying a live top-level parent creates one direct subcategory; a subcategory can never be selected as another category's parent.

Name or description edits do not change level or parent. A deleted, nonexistent, or already subordinate parent is refused without creating a category.

### REQ-CATEGORY-POLICIES-3 Assign products only to live categories

Product creation and category edit may select either a live top-level category or a live subcategory. A missing, deleted, or nonexistent selected category is refused.

An uncategorized product produced by category retirement may later choose another live category. Existing purchase and product snapshots retain the category captured at their own time even after that category is deleted.

### REQ-CATEGORY-POLICIES-4 Uncategorize products when taxonomy is retired

Deleting a category removes it from browsing and makes every directly assigned live product uncategorized. Deleting a top-level category also deletes its direct subcategories and uncategorizes products assigned to the parent or any removed child.

Product ownership, content, variants, inventory, and order history remain unchanged. Earlier product snapshots keep their captured category. A nonexistent target or non-administrator is refused without reclassification.

## REQ-PRODUCT-POLICIES Product validation and retirement policies

A product is seller-owned merchandise whose required catalog values, category, children, and edit evidence move as one aggregate. Ordinary sellers act only on their own live products and may retire them only after current fulfillment and request blockers clear.

Administrator policy deletion is intentionally different: it ends live exposure immediately across ownership, but it does not turn moderation into an implicit refund. Earlier orders and open customer obligations continue from retained commercial evidence.

### REQ-PRODUCT-POLICIES-1 Require valid product catalog data

Creation requires a nonempty name, nonempty description, live top-level category or subcategory, and numeric base price greater than or equal to zero. A zero base price is valid rather than missing.

The seller must be approved and neither suspended nor banned. The new product begins with no variants, so it is visible but unavailable. Missing or whitespace-only text, deleted or absent category, negative or nonnumeric price, or ineligible seller is refused.

### REQ-PRODUCT-POLICIES-2 Enforce product ownership

A seller may edit product fields, change images, change variants, or request ordinary deletion only for a live product they own and while eligible for that operation. Ownership does not transfer when product or shop values change.

A foreign identifier grants no access, and a refused attempt creates no child change, snapshot, or history. A foreign, absent, or deleted product, or a banned, deleted, unapproved, or suspended seller is refused. Administrator inspection and policy deletion are the platform-wide exceptions.

### REQ-PRODUCT-POLICIES-3 Snapshot the complete aggregate on catalog edit

Every accepted product-field or image upload, reorder, or deletion creates one immutable complete product snapshot. It contains:

- name, description, category, and base price;
- the entire image collection in current order; and
- every contemporaneous variant with SKU code, option values, and optional override price.

The evidence identifies change time, changed elements, and before-and-after values. Snapshot and live edit commit together; if evidence cannot be created, the live values do not change. Stock quantity stays in inventory history rather than this snapshot.

### REQ-PRODUCT-POLICIES-4 Block seller product deletion during fulfillment

Ordinary seller deletion requires zero product variants with an item in `paid` or `shipped`. Both states independently block; `delivered`, `cancelled`, and `refunded` do not block through item status alone.

The check spans every relevant variant identity and is repeated when deletion commits. Any matching item refuses deletion and leaves product, variants, images, inventory, wishlist, and cart state unchanged.

### REQ-PRODUCT-POLICIES-5 Block seller product deletion during unresolved requests

Ordinary seller deletion also requires zero `pending` cancellation or refund requests across every variant. Approved and rejected request history does not block through request state alone.

The check is repeated when deletion commits. Any pending request refuses deletion and leaves the complete aggregate unchanged. If a delivered item had no pending request when eligible deletion occurred, a later valid refund remains resolvable through the retained retired-variant evidence.

### REQ-PRODUCT-POLICIES-6 Retire violating merchandise without stranding obligations

An administrator may supply a nonempty policy-violation reason and remove any current product and its children from live commerce despite paid, shipped, or pending-request blockers. Moderation retains administrator, reason, target, and deletion time.

Existing order items, shipments, snapshots, and requests remain usable from purchase-time evidence. Deletion alone neither refunds an item nor restores stock. The seller may fulfill and decide requests when account state allows, while administrators keep force-resolution authority.

A later valid cancellation or refund restoration remains historical evidence and never recreates merchandise. Blank reason, non-administrator, absent product, or repeat deletion is refused.

## REQ-VARIANT-POLICIES Variant identity, price, availability, and retirement policies

The SKU is the durable identity, price-selection point, and stock unit beneath a product. A concrete option combination distinguishes it for customers, while a globally unique code keeps operational and historical references unambiguous.

Live purchase eligibility combines the variant, parent product, seller, and stock state. Ordinary deletion waits for active item and request obligations, but later eligible refund evidence can still refer to the retired identity without restoring merchandise.

### REQ-VARIANT-POLICIES-1 Require a unique SKU and concrete option combination

Adding or editing a variant requires a nonempty SKU code that is unique across the platform after trimming and case-insensitive comparison. Retired codes remain reserved because orders and snapshots still identify them.

The variant also requires at least one nonempty option name and value. Option names are unique within the variant after trimming and case-insensitive comparison, and two live variants of one product cannot have the same normalized set of option pairs.

A blank or duplicate SKU, blank name or value, duplicate option name, or duplicate option combination is refused. Accepted SKU or option edits create the complete product snapshot with the resulting variant set.

### REQ-VARIANT-POLICIES-2 Validate the optional price override

An absent override uses the current product base price. A supplied override must be numeric and at least zero; zero is a real present override and produces an effective price of zero.

A positive override replaces base price for that variant. Changing it updates future live presentation and creates snapshot evidence without rewriting fixed order values. Negative or nonnumeric input is refused and leaves the prior effective price unchanged.

### REQ-VARIANT-POLICIES-3 Require an available variant for purchase

Cart and checkout require selection of one live variant whose product and seller are purchasable. A zero-variant product stays discoverable but unavailable, and a zero-stock variant cannot enter a new cart line.

At checkout, available stock after concurrent holds must satisfy the line's entire quantity; the platform never buys a partial line. Missing, absent, or deleted SKU, deleted product, unapproved, suspended, banned, or deleted seller, zero stock, or insufficient full quantity is refused.

### REQ-VARIANT-POLICIES-4 Block variant deletion during fulfillment

Ordinary deletion requires no order item for the variant in `paid` or `shipped`. Either state blocks; `delivered`, `cancelled`, and `refunded` do not block through item status alone.

Eligibility is repeated when deletion commits. A matching item refuses deletion and leaves the live variant, inventory, cart availability, and snapshots unchanged.

### REQ-VARIANT-POLICIES-5 Block variant deletion during unresolved requests

Ordinary deletion also requires no `pending` cancellation or refund request for the variant. Approved and rejected request history does not block through request state alone.

Eligibility is repeated at commit. A matching pending request refuses deletion. If blocker-free deletion preceded a later valid delivered-item refund, the restoration uses retained retired-variant evidence and does not recreate the SKU.

## REQ-INVENTORY-POLICIES Inventory movement and stock policies

Every stock change is a signed ledger event tied to one SKU identity. Seller commands state their business direction; purchases and returns are emitted only by the journey that owns the money and item transition.

The live ledger cannot fall below zero or quantity already held for payment. Purchase and return effects use the exact order-item quantity and become visible with their related commercial state, never as detached stock changes.

### REQ-INVENTORY-POLICIES-1 Require attributable nonzero inventory movements

Each movement stores a nonzero whole-number quantity change, nonempty business reason, and event timestamp assigned when the record commits. The sign remains part of the stored value.

The movement belongs to exactly one live or retired variant identity. Zero or fractional quantity, whitespace-only reason, or missing variant identity is refused without changing the ledger or stock.

### REQ-INVENTORY-POLICIES-2 Apply seller movement signs

The owning seller submits a positive magnitude and nonempty reason. A restock stores the magnitude as positive; an adjustment or loss stores its negative. Current live stock changes by exactly that magnitude in the selected direction.

Seller commands cannot impersonate the automatic purchase, cancellation-restoration, or refund-restoration causes. A nonpositive magnitude, empty reason, foreign or deleted variant, or nonowner, banned, or deleted seller is refused.

### REQ-INVENTORY-POLICIES-3 Prevent negative or reserved-stock depletion

A negative movement for a live variant is accepted only when the resulting ledger sum remains at least zero and does not fall below quantity held by other active checkout attempts. The check and append serialize for that variant so concurrent deductions cannot oversell.

A successful purchase consumes its own matching hold and is not blocked by that hold. Any movement that would create a negative balance or consume another attempt's held quantity is refused, leaving ledger, calculated stock, and holds unchanged.

### REQ-INVENTORY-POLICIES-4 Deduct purchased quantity at order creation

Successful order creation posts one negative `purchase` movement for each distinct purchased variant, equal to its order-item quantity. Three units consolidated into one item produce one movement of `-3`; different variants receive separate records.

The matching hold is consumed. Order, paid items, purchase snapshots, cart removal, hold consumption, and movements commit together. Payment or order-commit failure writes no purchase movement and releases every hold for that attempt.

### REQ-INVENTORY-POLICIES-5 Restore returned item quantity exactly once

Approved cancellation, approved refund, or the corresponding administrator force action posts one positive restoration equal to the target item's purchased quantity. Cancellation and refund causes stay distinguishable.

The movement is unique for the order item and terminal cause, so a retry returns the existing outcome rather than restoring twice. Item and request transition, customer refund, restoration, and derived order status commit together, while other items and variants remain unchanged.

A failed refund or transition posts no movement. For a retired variant, the restoration is obligation evidence only and never recreates live stock.

## REQ-SNAPSHOT-POLICIES Snapshot integrity and visibility policies

Snapshots are durable evidence for source-named editable commercial content. They identify what changed, when, and the values before and after. Product evidence additionally captures the complete merchandise aggregate at that moment.

Stock deliberately follows another model: signed inventory events explain quantity changes. Neither owners nor administrators may alter evidence, and viewing is limited to the parties related to the underlying record or an authorized platform administrator.

### REQ-SNAPSHOT-POLICIES-1 Create evidence for covered commercial changes

Every accepted value-changing edit to product fields or images, variant SKU/options/override price, seller profile, or review creates an immutable snapshot. Each records change time, changed elements, and before-and-after values.

Creating a cancellation or refund request is the initial request record. Approving or rejecting it is the status modification that creates request-state snapshot evidence. The live change and its evidence commit together; inability to create required evidence refuses the change.

### REQ-SNAPSHOT-POLICIES-2 Capture the complete product aggregate

Every product snapshot contains:

- product name, description, category, and base price;
- every image in its then-current order, preserving which was first; and
- every variant then present, with SKU code, option values, and optional override price.

No absent variant is invented. Changed elements and before-and-after values accompany the complete resulting aggregate. Stock quantity is excluded and remains reconstructable from inventory history. An incomplete snapshot refuses its associated edit.

### REQ-SNAPSHOT-POLICIES-3 Use inventory history for stock changes

Restock, adjustment, loss, purchase, cancellation restoration, and refund restoration create inventory movements with signed quantity, business reason, and timestamp; they do not create stock snapshots.

Restock and restoration are positive, while adjustment, loss, and purchase are negative. Cancellation and refund restoration stay distinguishable, and current live stock is the working-ledger sum. This intentional absence of stock snapshots has no separate refusal.

### REQ-SNAPSHOT-POLICIES-4 Keep snapshots immutable and undeletable

Every attempt to edit or delete an existing snapshot is refused for customers, sellers, regular administrators, and super administrators. The snapshot bytes and identity remain unchanged.

A later live edit creates another snapshot. Deleting a live product, variant, review, seller profile, or account does not cascade into evidence, and authorized viewers retain access after live retirement.

### REQ-SNAPSHOT-POLICIES-5 Limit snapshot evidence to relevant parties

Snapshot visibility follows evidence type:

| Evidence | Authorized viewers |
| --- | --- |
| Product, variant, image, or seller-profile snapshot | Owning seller; regular or super administrator |
| Review snapshot | Review author; regular or super administrator |
| Cancellation or refund snapshot | Purchasing customer; target item's seller; regular or super administrator |
| Purchase-time order-item evidence | Purchasing customer; target item's seller; regular or super administrator |

A deleted owner loses authenticated access, while other still-relevant parties and administrator oversight retain theirs. An unrelated customer or seller, unauthenticated caller, or actor without the required relation or grade is refused.

## REQ-SEARCH-POLICIES Product search and listing policies

Product discovery crosses seller ownership but not moderation boundaries. It includes every live product from sellers currently permitted to expose merchandise, including visible unavailable and uncategorized products, while deletion, suspension, and ban remove list visibility.

Search constraints intersect over current catalog facts. The customer chooses one of three stable orders, and search and category pages share one product-card projection.

### REQ-SEARCH-POLICIES-1 Search the eligible cross-seller catalog

An authenticated customer searches products belonging to all approved, unsuspended, unbanned, nondeleted sellers. Seller ownership never narrows customer results.

Deleted products and products hidden by suspension or ban are excluded immediately, including administrator-retired products. An uncategorized live product remains name-searchable, and a live no-variant product remains visible as unavailable. An unauthenticated, banned, or deleted customer is refused.

### REQ-SEARCH-POLICIES-2 Combine product search constraints

All supplied constraints intersect:

- product name uses case-insensitive trimmed substring matching; blank or omitted name imposes no name restriction;
- category matches only direct assignment to the selected live category, not its children;
- minimum and maximum prices are inclusive and match when at least one live variant's effective price is within them; a no-variant product uses base price; and
- `in-stock only` requires at least one live variant with a positive working-ledger sum.

Either price bound may be omitted. A negative or nonnumeric bound, minimum greater than maximum, or absent or deleted category is refused.

### REQ-SEARCH-POLICIES-3 Order and page search results deterministically

Allowed sorts are:

- newest creation first, which is the default;
- lowest displayed effective price ascending; and
- lowest displayed effective price descending.

Both price directions use the same lowest displayed price key. Product identifier resolves equal keys in the corresponding deterministic direction. Pagination is bound to the full filter and sort criteria, so an unchanged result yields every match once; an unsupported sort or page position from different criteria is refused.

### REQ-SEARCH-POLICIES-4 Render the standard product card

Every search or category result shows thumbnail, current name, displayed price, current seller shop name, and average rating when at least one non-deleted review exists.

The first retained image is the thumbnail; a product without images uses a neutral no-image placeholder. Price presentation follows:

| Current variant set | Displayed price |
| --- | --- |
| No variants | Product base price |
| All variants share one effective price | That value |
| Effective prices differ | Minimum–maximum range |

An effective price is the present override, including zero, or otherwise the base price. A product with no variants is marked unavailable. Average rating is absent when no live review exists.

## REQ-WISHLIST-POLICIES Wishlist membership policies

A wishlist is a private, product-level reminder owned by one customer. It does not select merchandise for purchase, promise a price, or reserve inventory.

One retained relation represents each customer-product pair. Reversible availability changes remain visible to the owner, while product deletion removes the relation and stable pagination covers only the entries that remain.

### REQ-WISHLIST-POLICIES-1 Keep wishlist changes within the owning customer

An authenticated customer may add to or remove from only their own wishlist. A save creates a relation for that customer, and a removal deletes only that customer's matching relation; the same product may independently remain saved by other customers.

An unauthenticated, banned, deleted, or different customer attempting the mutation is refused.

### REQ-WISHLIST-POLICIES-2 Admit one live product entry per customer

Saving a retained live product creates one customer-product relation. Saving it again is an idempotent success: no duplicate is created and the original saved time remains unchanged. Concurrent duplicate saves converge on that same single relation.

A retained product may be saved even when it is out of stock, has no variants, or is temporarily hidden because its seller is suspended or banned. The product must still exist when the save commits; a missing or deleted target is refused.

### REQ-WISHLIST-POLICIES-3 Keep a wishlist entry product-scoped and nonreserving

A wishlist entry identifies a product, never a variant or quantity. It stores neither a promised purchase price nor a stock allocation.

Later product, variant, price, and stock changes do not rewrite the entry. Saving creates no inventory movement, and purchase still requires the customer to choose an eligible variant through cart and checkout.

### REQ-WISHLIST-POLICIES-4 Page retained wishlist products consistently

Wishlist pages show the owner's retained products newest saved first. Saved time followed by a stable entry identifier resolves ties, so an unchanged traversal neither duplicates nor skips an entry. A page position issued to another customer or under a changed query context is refused.

Temporary stock loss, absence of variants, seller suspension, or seller ban leaves the entry present but marks the product unavailable. Product deletion by a seller or administrator removes that product from every later wishlist page.

## REQ-CART-POLICIES Cart quantity and availability policies

A cart has one line per customer and variant. Its quantity is expressed in discrete units, repeated additions accumulate on that line, and changing quantity replaces the line's requested total.

The cart remains a revisable view rather than a reservation. It shows current prices and availability even after catalog or stock drift, while checkout selects only lines that can be fulfilled exactly as saved.

### REQ-CART-POLICIES-1 Require a positive whole-unit cart quantity

Adding a variant and replacing a line quantity both require a positive whole number. One is the minimum; the platform stores the requested value exactly and never rounds it. Quantity replacement sets the requested total rather than applying a delta.

Zero, a negative value, a fraction, or a nonnumeric value is refused without changing the cart. Zero is not an implicit remove command.

### REQ-CART-POLICIES-2 Merge repeated variant additions

Adding a variant already in the customer's cart atomically adds the requested quantity to the existing quantity. Exactly one line remains for the customer-variant pair, and concurrent additions do not lose an increment.

A resulting quantity above positive stock is retained with a shortage warning. If the variant has since been deleted or its current stock has reached zero, the merge is refused without changing the line.

### REQ-CART-POLICIES-3 Admit only a purchasable live variant

A new line requires a specifically selected live variant with positive current stock. Its product must be live and its seller approved, unsuspended, and unbanned. A requested quantity above positive stock may be saved but receives a shortage warning immediately.

A missing or deleted variant, missing or deleted product, zero-stock variant, suspended or banned seller, or unapproved seller is refused. Cart addition reserves no stock and creates no inventory movement.

### REQ-CART-POLICIES-4 Expose current cart price and availability

Each cart line shows current product name, current variant options, current effective unit price, saved quantity, and subtotal. The subtotal is unit price multiplied by quantity. The cart total is the sum of every saved line subtotal, including unavailable lines, so the full saved cart remains understandable.

A positive-stock line below its saved quantity carries a shortage warning. A deleted variant or product, zero-stock variant, or product hidden by seller suspension or ban is marked unavailable and retained for correction or removal. A customer cannot inspect another customer's cart.

### REQ-CART-POLICIES-5 Exclude ineligible lines from checkout

Checkout selects all and only the customer's lines whose variant and product remain live, whose seller remains purchasable, and whose current stock covers the full saved quantity. An eligible line is never silently reduced.

Unavailable and short-stock lines remain in the cart. Selection itself removes no line and consumes no stock. At least one fully eligible line is required; otherwise checkout is refused.

## REQ-CHECKOUT-POLICIES Checkout, payment, and order-creation policies

Checkout turns the customer's currently eligible cart lines and retained address into a reviewable purchase. Prices, stock, catalog visibility, seller eligibility, quantity, and address ownership are checked again before the external gateway is invoked.

A payment attempt owns its stock holds and terminal outcome. Failure leaves a clean retry path, while success exposes the order, purchase evidence, inventory movements, and cart removal as one consistent result.

### REQ-CHECKOUT-POLICIES-1 Require purchasable lines and an owned address

Checkout requires at least one fully eligible line and a retained shipping address owned by the customer. All eligible cart lines enter the review; unavailable and short-stock lines stay in the cart. An explicit address selection takes precedence over an existing default.

The review shows the selected items and current prices, the full shipping address, and total price. It does not change the address record. No eligible line, no selected or existing default address, a deleted address, or another customer's address is refused.

### REQ-CHECKOUT-POLICIES-2 Refresh material purchase facts before charge

When the customer confirms, the platform revalidates current effective prices, full requested stock, cart quantities, variant and product liveness, seller eligibility, and address ownership. A price, stock, quantity, product, variant, seller, or address change invalidates the previous summary and requires the customer to review the refreshed values.

A valid confirmation places temporary stock holds for the attempt before calling the gateway. The holds cover the full quantities, prevent another checkout from consuming them, and do not yet create inventory movements. Payment is not started if a reviewed fact fails or the quantities cannot be held.

### REQ-CHECKOUT-POLICIES-3 Fix the purchase shipping address

Successful order creation copies recipient name, phone number, street address, city, state or province, postal code, and country into an immutable order shipping-address value. Later edits or deletion of the customer's address do not alter that purchase evidence.

No customer, seller, or administrator may change the address of a placed order. Order history always displays the purchase-time value, and an attempted change is refused.

### REQ-CHECKOUT-POLICIES-4 Recover cleanly from unsuccessful payment

An explicit gateway failure releases the attempt's stock holds and creates no order, inventory movement, or cart removal. Every selected line remains available for correction or a new retry.

If the immediate result is unknown, the platform reconciles the same payment-attempt identifier before permitting a distinct retry. A later confirmed success follows the success path exactly once. A later confirmed failure releases the holds and permits a new attempt; starting another attempt while the first remains unresolved is refused.

### REQ-CHECKOUT-POLICIES-5 Make gateway success idempotent

A confirmed gateway success is bound to its payment-attempt identifier and creates exactly one order. Repeated success notifications return that same outcome. The charged amount must equal the confirmed reviewed total, and the order receives one generated unique immutable order number.

A success for an unknown attempt, a mismatched amount, or a result incompatible with an already recorded terminal outcome does not enter ordinary order creation. It is retained for payment reconciliation so no paid event is lost or turned into an untracked duplicate order.

### REQ-CHECKOUT-POLICIES-6 Commit the successful purchase atomically

A valid unreconciled success atomically:

- creates the order and one paid item for each purchased variant with its full quantity;
- captures product, variant, effective price, seller profile, and shipping-address evidence;
- posts one exact negative inventory movement per order item, linked by its reason; and
- removes only the purchased lines from the cart.

Excluded or newly added cart lines remain. If current facts no longer match the held attempt, or any required effect cannot be persisted, none of these effects becomes visible; the paid result enters reconciliation before any retry.

## REQ-ORDER-POLICIES Order composition, pricing, and status policies

An order is one purchase container whose lines may belong to different sellers and progress independently. Purchase-time values determine money and historical presentation, while current item and shipment states determine fulfillment and the derived overall status.

### REQ-ORDER-POLICIES-1 Calculate the fixed purchase total

The order total is the sum, over every order item, of purchase-time unit price multiplied by purchased quantity. Each subtotal uses the captured effective variant price, including a zero override. An order always contains at least one item.

Later product or variant price edits never change an item subtotal or the order total.

### REQ-ORDER-POLICIES-2 Consolidate purchased units by variant

All units of the same purchased variant become one order item with their combined quantity. Purchasing three units of one SKU therefore creates one item with quantity three.

Different variants, including variants of one product, remain separate items. Items belonging to different sellers may coexist in the order, and every item retains the seller responsible for its purchased variant.

### REQ-ORDER-POLICIES-3 Keep fulfillment and resolution item-scoped

Cancellation and refund target one order item. Shipping groups eligible items into a seller-owned shipment, and customer delivery confirmation targets that shipment rather than an individual line.

Only the seller captured for an item may perform its ordinary shipping or request-response actions. The purchasing customer owns cancellation and refund requests and delivery confirmation. A mismatched customer, seller, or shipment relation is refused, while an allowed action leaves unrelated items unchanged. Administrator force actions follow their separate oversight rules.

### REQ-ORDER-POLICIES-4 Derive the complete overall order status

The platform recalculates overall order status after every item transition:

| Current item-state set | Overall status |
| --- | --- |
| Every item is `paid` | `paid` |
| At least one item is `shipped` and no item is `delivered` | `shipped` |
| Every item is `delivered` | `delivered` |
| Every item is `cancelled` | `cancelled` |
| Every item is `refunded` | `refunded` |
| Any other mixture, including delivered with another state or cancelled and refunded together | `partially completed` |

The overall value is derived and cannot be set directly.

### REQ-ORDER-POLICIES-5 Present orders from purchase-time evidence

Order list totals and detail presentation use immutable purchase-time evidence rather than current catalog, profile, or address values. Item detail shows captured product name and description, variant options, unit price, quantity, and current item status. Seller presentation uses captured shop name and logo.

Shipment tracking and shipment-item membership remain live fulfillment facts linked to retained items. Later editing or deletion of the customer, seller, product, variant, seller profile, or customer address neither erases nor rewrites the order.

The purchasing customer may view the whole order. A seller sees only their own items, and administrators use oversight access; a customer attempting to view another customer's order is refused.

## REQ-SHIPMENT-POLICIES Shipment eligibility and delivery policies

A shipment is one seller's package for selected paid items from one order. Its members share the order's purchaser and immutable destination as well as one carrier, tracking number, shipping time, and delivery outcome.

Sellers may split their items across packages or bundle several eligible lines. Creation changes the selected items together, and either customer confirmation or the fourteen-day timeout completes the remaining shipped lines.

### REQ-SHIPMENT-POLICIES-1 Select eligible paid items for shipment

A seller must select one or more of their order items that are still `paid`, have no shipment, and have no pending cancellation request. One item may ship alone, or several eligible items may be bundled.

The platform atomically rechecks seller ownership and eligibility at commit. An empty selection, non-paid item, already assigned item, foreign-seller item, or item with a pending cancellation request is refused without changing any item.

### REQ-SHIPMENT-POLICIES-2 Keep one seller and destination per shipment

Every shipment belongs to one seller and one order and contains only that seller's eligible items from that order. Its members therefore share the purchasing customer and immutable shipping address.

Different sellers always use different shipments. The same seller may create multiple shipments for different subsets of one order. A selection spanning sellers, orders, customers, or shipping addresses is refused.

### REQ-SHIPMENT-POLICIES-3 Require complete shared tracking information

Shipment creation requires a nonblank carrier name and tracking number. Leading and trailing whitespace is ignored when deciding whether either value is blank.

The shipment records one shipping time, and every included item shares its carrier and tracking number. Those values are visible to the purchasing customer. Blank tracking information is refused without creating a shipment.

### REQ-SHIPMENT-POLICIES-4 Ship all package items together

Committing an eligible shipment atomically creates its seller, item membership, carrier, tracking number, and shipping time and changes every included item from `paid` to `shipped`. No unselected item changes, and overall order status is recalculated afterward.

If one selected item loses eligibility or any required effect fails, no shipment is created and no item changes status.

### REQ-SHIPMENT-POLICIES-5 Confirm delivery for the whole shipment

Only the purchasing customer may confirm receipt, and confirmation targets a still-shipped shipment rather than one included line. Every included item changes from `shipped` to `delivered` atomically and records the same delivery time; overall order status is then recalculated.

Another customer, a seller or administrator using this customer command, or a shipment with any item no longer shipped is refused.

### REQ-SHIPMENT-POLICIES-6 Complete unconfirmed shipments after fourteen days

At shipping time plus fourteen days, if the customer has not confirmed the package, every included item still in `shipped` changes to `delivered` once and records the automatic-delivery time. Already delivered, cancelled, or refunded items are unchanged.

The platform recalculates overall order status after the transition. This scheduled transition is applied at most once per item.

## REQ-CANCELLATION-POLICIES Cancellation eligibility and resolution policies

Cancellation is a purchaser request about one paid, unshipped order item. The responsible seller decides one pending request, and an approval reverses only that line while retaining immutable decision evidence.

### REQ-CANCELLATION-POLICIES-1 Admit a cancellation request for a paid item

The purchasing customer may create a `pending` cancellation request for exactly one of their items while it remains `paid`, unshipped, and unassigned to a shipment. The request records a nonblank text reason, target item, customer, and creation time.

Creating the request does not yet change the item, refund money, or restore stock. A foreign item, non-paid item, already assigned item, or blank reason is refused.

### REQ-CANCELLATION-POLICIES-2 Keep one pending cancellation decision per item

At most one cancellation request may be pending for an item. A duplicate is refused and creates no second request.

After a rejection, the purchaser may try again if the item is still paid and otherwise eligible. Approval closes cancellation eligibility because the item becomes cancelled.

### REQ-CANCELLATION-POLICIES-3 Limit ordinary cancellation response to the item seller

Only the seller captured for the target item may approve or reject its ordinary cancellation request. A suspended seller retains this existing-order responsibility.

A different seller and the purchasing customer cannot decide the request, and a banned seller cannot authenticate. Administrator force cancellation is a separate oversight command rather than an ordinary seller response.

### REQ-CANCELLATION-POLICIES-4 Decide a pending cancellation once

An eligible seller response changes a pending request exactly once to `approved` or `rejected` and records immutable before-and-after request evidence, decision time, and responding seller. Concurrent approve and reject attempts yield one terminal decision.

Rejection leaves the item paid and creates no refund or inventory movement. A missing, previously decided, or no-longer-paid target is refused without another snapshot.

### REQ-CANCELLATION-POLICIES-5 Apply an approved cancellation atomically

Approval atomically changes the request to `approved`, changes the target item to `cancelled`, refunds that line's paid amount, restores its full purchased quantity with one positive inventory record, captures the response snapshot, and recalculates overall order status. Refund and restoration occur exactly once.

For a retired SKU, the positive restoration evidence remains attached to its retained SKU identity without recreating a live variant or saleable stock. Every other order item, shipment, and request remains unchanged.

If the target is no longer paid, or any refund, snapshot, inventory, item, or aggregate effect fails, none of the approval effects becomes visible.

## REQ-REFUND-POLICIES Refund eligibility and resolution policies

A refund is a purchaser request about one delivered order item during that item's seven-day window. The responsible seller decides one pending request, and approval refunds and restores only that line while retaining immutable decision evidence.

### REQ-REFUND-POLICIES-1 Admit a timely refund request for a delivered item

The purchasing customer may create a `pending` refund request for exactly one of their items while it is `delivered`. The request needs a nonblank text reason and must commit at or before the item's delivery time plus seven days. It records the reason, item, customer, and creation time.

Creating the request does not yet change item status, refund money, or restore stock. A foreign item, non-delivered item, blank reason, or target without a delivery time is refused.

### REQ-REFUND-POLICIES-2 Close the refund window after seven days

Each item uses its own recorded delivery time, whether customer-confirmed or automatic. A request is timely through the instant equal to delivery time plus seven days and late after that instant. The platform evaluates this boundary when request creation commits.

A late request is refused without creating a request or changing item, payment, inventory, or order state.

### REQ-REFUND-POLICIES-3 Keep one pending refund decision per item

At most one refund request may be pending for an item. A duplicate is refused and creates no second request.

After rejection, the purchaser may try again only while the item remains delivered and its seven-day window remains open. Approval closes refund eligibility because the item becomes refunded.

### REQ-REFUND-POLICIES-4 Limit ordinary refund response to the item seller

Only the seller captured for the target item may approve or reject its ordinary refund request. A suspended seller retains this existing-order responsibility.

A different seller and the purchasing customer cannot decide the request, and a banned seller cannot authenticate. Administrator force refund is a separate oversight command rather than an ordinary seller response.

### REQ-REFUND-POLICIES-5 Decide a pending refund once

An eligible seller response changes a pending request exactly once to `approved` or `rejected` and records immutable before-and-after request evidence, decision time, and responding seller. Concurrent approve and reject attempts yield one terminal decision.

Rejection leaves the item delivered and creates no refund or inventory movement. A missing, previously decided, or no-longer-delivered target is refused without another snapshot.

### REQ-REFUND-POLICIES-6 Apply an approved refund atomically

Approval atomically changes the request to `approved`, changes the target item to `refunded`, refunds that line's paid amount, restores its full purchased quantity with one positive inventory record, captures the response snapshot, and recalculates overall order status. Refund and restoration occur exactly once.

For a retired SKU, the positive restoration evidence remains attached to its retained SKU identity without recreating a live variant or saleable stock. Every other order item, shipment, and request remains unchanged.

If the target is no longer delivered, or any refund, snapshot, inventory, item, or aggregate effect fails, none of the approval effects becomes visible.

## REQ-REVIEW-POLICIES Review eligibility, ordering, and rating policies

A review is verified product feedback tied to an order the author bought and received. One product-order opportunity yields one review identity even when the purchase contained several units or variants.

Live reviews appear publicly and contribute to rating presentation. Editing changes the live contribution with immutable history, deletion retires it, and customer-account deletion preserves it under anonymous attribution.

### REQ-REVIEW-POLICIES-1 Require a verified delivered purchase

The acting customer may publish a review only when their qualifying order contains at least one `delivered` item for the retained live product. The review links that customer, product, and order.

Qualification is product-level even though purchase used a variant. Multiple units provide one opportunity, not one per unit. A non-purchaser, an order without a delivered item for the product, a deleted product, or an unavailable customer account is refused.

### REQ-REVIEW-POLICIES-2 Validate review rating and optional text

A live review has one required integer rating: `1`, `2`, `3`, `4`, or `5`. Text is optional, so publication may omit it and a later edit may add, replace, or clear it.

A missing rating, fractional rating, or value outside the five allowed integers is refused without publishing or changing the review.

### REQ-REVIEW-POLICIES-3 Keep one review identity per product and order

At most one review identity exists for a customer, product, and order tuple. Multiple quantities or variants of the product in one order still provide one opportunity; a later distinct delivered order provides another.

Deleting a review retires rather than frees the tuple. A second review for an existing or retired tuple is refused.

### REQ-REVIEW-POLICIES-4 Keep review mutation with the author

Only the authenticated author may edit or delete a live review. An edit creates an immutable before-and-after snapshot of rating and text. Deletion removes the review from public display and rating aggregates but preserves its identity and every snapshot.

Product deletion hides its reviews with the retired product; those reviews remain dispute evidence but cannot be edited through the deleted product. A nonauthor, deleted review, deleted product for edit, or unavailable author account is refused.

### REQ-REVIEW-POLICIES-5 Order live reviews by publication time

Product detail lists non-deleted reviews by original publication time newest first, with review identifier breaking equal times. Editing does not change publication time or move an older review to the top.

Deleted reviews are absent. Paging an unchanged set neither duplicates nor skips a review; a page position issued for another product or changed review context is refused.

### REQ-REVIEW-POLICIES-6 Calculate the live product rating

Average rating is the sum of every non-deleted review rating divided by the number of those reviews. The customer-facing value is rounded half up to one decimal place. Each live review contributes once regardless of purchase quantity.

Editing replaces the prior contribution, review deletion removes it, and customer-account deletion leaves it in place. With no non-deleted reviews, product presentation reports no average rating and a review count of zero.

### REQ-REVIEW-POLICIES-7 Anonymize retained reviews after account deletion

When an author deletes the customer account, every retained live review continues to show its unchanged rating and optional text with the exact attribution `deleted user` and no profile link. Its rating continues to contribute to the product average and count.

Review snapshots remain immutable, and the deleted customer can no longer authenticate to edit or delete the review.

## REQ-CUSTOMER-ACCOUNT-POLICIES Customer closure and retention policies

Customer closure is an authenticated, irreversible action by the acting customer. It removes credentials and working personal state, but commercial and legal history survives for the parties responsible for it.

Reviews follow a distinct privacy path: their content remains useful, while public attribution no longer exposes the former customer.

### REQ-CUSTOMER-ACCOUNT-POLICIES-1 Authenticate irreversible customer closure

An authenticated customer must confirm the correct current password for that same identity immediately before closure commits. The platform rechecks the acting identity and closure eligibility at commit, including whether the customer identity is the final active super administrator.

A wrong password, stale or foreign session, banned or deleted customer, attempt to target another customer, or closure that would remove the final active super administrator is refused without deletion. A successful result is irreversible.

### REQ-CUSTOMER-ACCOUNT-POLICIES-2 Remove working personal customer state

Closure terminates every customer session on every device and removes credentials, display name, phone number, all saved addresses and their default designation, wishlist entries, and cart lines. None of these removed values remains available through customer access.

A later registration may reuse the former email, but it creates a distinct identity and inherits neither the removed collections nor retained commercial history.

### REQ-CUSTOMER-ACCOUNT-POLICIES-3 Retain the commercial order graph

Orders, order items, immutable shipping-address values, shipments, cancellation and refund requests, inventory evidence, and purchase snapshots remain retained. Sellers retain access to their own items and requests, and administrators retain oversight access.

The deleted customer no longer has authenticated order-history access. Retained participant evidence supports the record without restoring the removed profile or exposing it to unrelated actors.

### REQ-CUSTOMER-ACCOUNT-POLICIES-4 Anonymize retained customer reviews

Every retained live review keeps its rating and optional text but replaces author presentation with the exact label `deleted user` and removes the profile link. It remains in newest-first display, and its rating continues to contribute to average and count.

Review snapshots remain immutable. The deleted author can no longer edit or delete the review.

### REQ-CUSTOMER-ACCOUNT-POLICIES-5 Keep customer closure permanent

A deleted customer identity cannot log in, renew a session, recover a password, or be reactivated. Previously issued sessions stay invalid, and email recovery cannot target the deleted credential.

Re-registration with a formerly used email creates a new customer identity. Retained orders and reviews never transfer to that new identity; every attempt to authenticate, recover, or reactivate the deleted identity is refused.

## REQ-ADMIN-GOVERNANCE-POLICIES Administrator application and grade policies

Administrator authority is a grade on an existing customer or seller identity. Ordinary actors apply for the regular grade; super administrators alone admit them and control the super grade.

One provisioned super administrator makes the workflow reachable. Later grade changes and account closure preserve at least one active super administrator without granting governance authority through ordinary registration.

### REQ-ADMIN-GOVERNANCE-POLICIES-1 Admit an administrator application

An authenticated customer or seller with no administrator grade may submit a nonblank text reason for the acting identity. The platform creates a `pending` application recording applicant identity and type, reason, and creation time, and the applicant can view it.

Submission changes no credential, commercial record, or authority. An empty reason, banned or deleted identity, current regular or super administrator, or application for another identity is refused.

### REQ-ADMIN-GOVERNANCE-POLICIES-2 Keep one pending application per identity

At most one administrator application may be pending for an identity. A duplicate creates no second request.

After rejection, a still-eligible ordinary customer or seller may submit a new application; the new record does not overwrite the retained rejection. Another application while one is pending, or after approval has granted an administrator grade, is refused.

### REQ-ADMIN-GOVERNANCE-POLICIES-3 Reserve application decisions for super administrators

Only a current super administrator may page through the platform-wide pending queue or approve or reject a pending application. A decision records the deciding super administrator and decision time and applies once.

Applicants may view their own history but cannot use the platform-wide queue or decision commands. A regular administrator, ordinary customer or seller, banned or deleted actor, or non-pending request is refused.

### REQ-ADMIN-GOVERNANCE-POLICIES-4 Grant the regular administrator grade on approval

Approval atomically changes the request to `approved` and grants `regularAdministrator`—not `superAdministrator`—to the applicant's existing customer or seller identity. Credentials and the underlying identity stay unchanged, and regular authority is effective immediately.

Rejection grants no grade and leaves the applicant ordinary. If the request or applicant loses eligibility, or either the request transition or grade grant fails, neither effect commits.

### REQ-ADMIN-GOVERNANCE-POLICIES-5 Provision the initial super administrator

At first platform initialization, a controlled provisioning process assigns `superAdministrator` to exactly one existing, usable customer or seller identity before any administrator application can be decided. The grade includes all regular administrator permissions.

Ordinary customer or seller registration never grants an administrator grade. After bootstrap, all grade changes use the normal super-administrator commands. Application decision processing is refused while no active super administrator exists.

### REQ-ADMIN-GOVERNANCE-POLICIES-6 Reserve super-grade changes for super administrators

Only a current super administrator may:

- promote a current regular administrator by granting `superAdministrator`; or
- demote another current super administrator by revoking `superAdministrator` while preserving `regularAdministrator`.

Both changes take effect immediately. A banned regular administrator cannot be promoted, while a banned super administrator may be demoted to remove authority. A non-super caller, deleted target, wrong target grade, or duplicate grade change is refused.

### REQ-ADMIN-GOVERNANCE-POLICIES-7 Refuse super-administrator self-demotion

A super administrator cannot demote the same identity. The command is always refused, no substitute target is inferred, and all grades stay unchanged.

Another super administrator may perform an otherwise eligible demotion.

### REQ-ADMIN-GOVERNANCE-POLICIES-8 Preserve one active super administrator through closure

When a customer or seller identity holding `superAdministrator` requests account closure, the platform atomically rechecks the active super-administrator population. Closure is refused if that identity is the only active super administrator.

An active second super administrator permits closure when all account-specific conditions also pass. Successful closure revokes every administrator grade on the deleted identity and never leaves governance authority attached to it.

## REQ-ADMIN-OVERSIGHT-POLICIES Administrator moderation and force-resolution policies

Regular and super administrators inspect records across ownership boundaries. Moderation separates login ban from seller catalog suspension, while product retirement removes policy-violating merchandise without erasing commercial evidence or silently resolving paid obligations.

Forced order actions remain item-based even when invoked for an entire order. Each eligible line receives its exact money, stock, state, and evidence outcome once; unrelated or ineligible lines remain inspectable.

### REQ-ADMIN-OVERSIGHT-POLICIES-1 Inspect the complete platform record

A current regular or super administrator may inspect all current customer and seller accounts, all current products and retained deleted-product evidence, and all retained orders across the platform.

Account inspection includes ban state and administrator grades; seller inspection also includes approval and suspension. Product oversight includes immutable snapshots after deletion. Order oversight includes purchase evidence, shipments, cancellation and refund requests, and forced-action history. An actor without a current usable administrator grade is refused.

### REQ-ADMIN-OVERSIGHT-POLICIES-2 Suspend account access without deleting history

Banning a current customer or seller sets login state to banned, terminates all active sessions, and refuses new login and session renewal. Customer profile, addresses, wishlist, cart, orders, requests, reviews, snapshots, and grades remain retained. Seller profile, products, inventory history, orders, shipments, requests, snapshots, and grades also remain.

A banned seller's products are hidden and unpurchasable, and the seller cannot process existing orders until unbanned. Unban permits a new login but never revives a terminated session.

A non-administrator, self target, deleted target, target already in the requested state, or regular administrator targeting a super administrator is refused.

### REQ-ADMIN-OVERSIGHT-POLICIES-3 Compose seller suspension and ban independently

Suspension controls catalog creation, product editing, list visibility, and purchase. Ban independently controls login and authenticated seller work.

| Seller state | Catalog and order effect |
| --- | --- |
| Suspended, not banned | Products are hidden and unpurchasable; the seller may log in, edit the seller profile, manage inventory, ship existing items, and decide requests, but cannot create or edit products. |
| Banned, not suspended | The seller cannot log in; products are hidden and unpurchasable. |
| Suspended and banned | Neither catalog exposure nor authenticated existing-order work is available. |

Unsuspension while banned does not expose products until unban. Unban while suspended restores existing-order work but not catalog visibility. Neither restriction changes approval state or deletes history.

### REQ-ADMIN-OVERSIGHT-POLICIES-4 Retire a policy-violating product without rewriting orders

An administrator may retire a current product for a nonblank policy reason. The product, images, selectable variants, working inventory history, wishlist relations, and listing presence leave live commerce immediately; retained cart lines become unavailable. All snapshots and purchase evidence remain.

Paid or shipped items and pending cancellation or refund requests do not block this path. Deletion itself creates no refund or stock restoration. Existing orders, shipments, and requests remain usable for ordinary fulfillment and response or an administrator force action.

A later valid positive restoration record stays attached to retired SKU evidence and does not recreate live merchandise. A missing or already deleted product, blank reason, or non-administrator is refused.

### REQ-ADMIN-OVERSIGHT-POLICIES-5 Force-cancel an eligible order item

For a nonblank policy reason, an administrator may change a `paid` or `shipped` item to `cancelled`, refund its line amount, restore its purchased quantity with one positive inventory record, and recalculate order status. These effects commit atomically and occur exactly once.

A matching pending cancellation request becomes `approved` with immutable administrator-attributed decision evidence; no request is invented when none exists. Prior tracking remains historical evidence, other items remain unchanged, and retired-SKU restoration remains evidence without recreating merchandise.

A missing, delivered, cancelled, or refunded item, blank reason, non-administrator, failed refund, or failed atomic effect is refused without partial change.

### REQ-ADMIN-OVERSIGHT-POLICIES-6 Force-refund an eligible order item

For a nonblank policy reason, an administrator may change a `paid`, `shipped`, or `delivered` item to `refunded`, refund its line amount, restore its purchased quantity with one positive inventory record, and recalculate order status. These effects commit atomically and occur exactly once.

A matching pending refund request becomes `approved` with immutable administrator-attributed decision evidence; no request is invented when none exists. Shipment, delivery, purchase snapshots, and published review history remain intact, other items remain unchanged, and retired-SKU restoration does not recreate merchandise.

A missing, cancelled, or already refunded item, pending cancellation request, blank reason, non-administrator, failed refund, or failed atomic effect is refused without partial change.

### REQ-ADMIN-OVERSIGHT-POLICIES-7 Apply a force action across an order's eligible items

The whole-order force-cancel command selects every `paid` or `shipped` item. The whole-order force-refund command selects every `paid`, `shipped`, or `delivered` item. The administrator supplies one nonblank policy reason, cannot choose a smaller subset, and the result reports every affected and ineligible line.

Cancelled and refunded items stay unchanged; delivered items are also ineligible for force-cancel. Any pending cancellation on a force-refund-eligible line blocks the entire refund command. At least one item must qualify.

All selected item actions share the administrator, reason, and action time and commit atomically, followed by one overall-status recalculation. A missing order, blank reason, no eligible item, cancellation conflict, non-administrator, or failed item effect refuses the whole command without partial change.

## REQ-SELLER-DASHBOARD-POLICIES Seller dashboard calculation policies

The seller dashboard reports one shop at a common observation time. Catalog size uses current retained products, while sales volume and request workload follow retained purchase-time seller attribution even after catalog retirement.

### REQ-SELLER-DASHBOARD-POLICIES-1 Count the seller's current products

Product total counts every non-deleted product owned by the acting seller. Products with no variants, no stock, or temporary hiding caused by seller suspension or ban remain included while retained.

A product deleted by its seller or an administrator is excluded. Another seller's product never contributes, and a banned or deleted seller cannot access the dashboard.

### REQ-SELLER-DASHBOARD-POLICIES-2 Count all retained seller order items

Order-item total counts every retained item attributed to the acting seller's purchase-time seller evidence across `paid`, `shipped`, `delivered`, `cancelled`, and `refunded`.

Product, variant, or seller account deletion does not remove a historical line. Each order item contributes once regardless of its purchased quantity, and an item attributed to another seller never contributes.

### REQ-SELLER-DASHBOARD-POLICIES-3 Count unresolved seller requests

The dashboard separately counts cancellation requests and refund requests whose target item belongs to the seller and whose current status is `pending`. Approved and rejected requests do not contribute, and each pending request contributes to exactly one measure.

Product total, order-item total, pending cancellation count, and pending refund count describe the same reporting moment. A suspended seller retains dashboard access; a banned or deleted seller does not.

### REQ-SELLER-DASHBOARD-POLICIES-4 Filter seller order items by one exact status

The optional order-item filter accepts exactly one of `paid`, `shipped`, `delivered`, `cancelled`, or `refunded`. Omitting it includes all five states. Only items attributed to the acting seller remain eligible, and the filter matches current item status.

Rows remain newest purchase first, with order-item identifier breaking equal times. Product deletion does not remove a matching row. An unsupported status, foreign seller scope, or banned or deleted seller is refused.

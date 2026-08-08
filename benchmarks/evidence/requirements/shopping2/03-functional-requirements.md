# Functional Requirements

This document specifies actor-visible commands, queries, reports, and end-to-end journeys. Domain meanings and state formulas are defined in the domain model; validations and thresholds are owned by the business-rules document.

## REQ-CUSTOMER-PROFILE-FUNCTIONS Customer profile operations

The authenticated customer can inspect and maintain the two personal profile values attached to that identity. Both operations are self-scoped, and neither changes credentials or commercial records.

### REQ-CUSTOMER-PROFILE-FUNCTIONS-1 View the customer profile

The platform returns the acting customer's current display name and phone number. It does not expose credentials, orders, addresses, or administrator grades as profile fields.

Another customer's profile, or a request from an unauthenticated, banned, or deleted identity, is refused.

### REQ-CUSTOMER-PROFILE-FUNCTIONS-2 Edit the customer profile

The customer may replace the acting profile's display name and phone number. Later views return the new values; credentials, addresses, orders, and review content are unchanged.

An attempt to edit another customer's profile, or one made by an unauthenticated, banned, or deleted identity, is refused. Later account deletion removes the updated profile.

## REQ-SHIPPING-ADDRESS-FUNCTIONS Shipping address operations

Customers maintain an independently editable collection of complete delivery destinations. A default is an optional convenience designation; checkout still permits another owned address, and purchase-time copies remain independent of later saved-address changes.

### REQ-SHIPPING-ADDRESS-FUNCTIONS-1 List saved addresses

The platform returns all addresses owned by the acting customer and identifies the current default, if any. Every result includes recipient name, phone, street address, city, state or province, postal code, and country.

The collection may be empty or have no default. Another customer's records are excluded, and an unauthenticated, banned, or deleted customer is refused.

### REQ-SHIPPING-ADDRESS-FUNCTIONS-2 Add a shipping address

The customer may add an address by submitting all seven destination fields. The new address appears in later lists; existing addresses and the current default remain unchanged.

Creation does not automatically make the address default. A missing field or unavailable customer account is refused.

### REQ-SHIPPING-ADDRESS-FUNCTIONS-3 Edit a saved address

The customer may replace all destination fields of one owned address. Later lists show the new values, and an existing default designation remains attached to that address.

The edit never changes an address already copied to an order. Another customer's address, incomplete input, or an unavailable account is refused.

### REQ-SHIPPING-ADDRESS-FUNCTIONS-4 Delete a saved address

The customer may delete an owned saved address. Other saved addresses and every existing order-address copy remain unchanged.

If the removed address was default, the customer has no default until another is explicitly selected. A nonexistent or differently owned address is refused.

### REQ-SHIPPING-ADDRESS-FUNCTIONS-5 Set the default address

The customer may select one retained owned address as the sole default. Any former default loses the designation, while both addresses' content remains unchanged.

Checkout may still choose a different owned address. A deleted or differently owned address cannot be selected.

## REQ-SELLER-PROFILE-FUNCTIONS Seller profile operations

Seller profiles serve two audiences: the seller maintains the live shop presentation, while customers inspect its public values. Every seller edit creates evidence, and purchase-time copies remain independent.

Account moderation controls login, selling, and product visibility without silently deleting a retained profile. Seller deletion removes the live profile but not order-item shop evidence.

### REQ-SELLER-PROFILE-FUNCTIONS-1 View the own seller profile

The platform returns the acting seller's current shop name, shop description, and logo. This is the live profile, not a historical snapshot; approval, suspension, ban, and credential fields remain separate.

Another seller's owner view, or access by a banned or deleted seller, is refused.

### REQ-SELLER-PROFILE-FUNCTIONS-2 Edit the seller profile

An eligible seller may replace the shop name, description, or logo. Later customer views show the new live values, and a complete immutable seller-profile snapshot records time, changed fields, and before-and-after values across the profile.

Purchase-time seller snapshots on existing order items remain unchanged. Another seller, or a suspended, banned, or deleted seller, cannot perform the edit.

### REQ-SELLER-PROFILE-FUNCTIONS-3 View a public seller profile

An authenticated customer may view the selected seller's shop name, shop description, and logo. A discoverable product's shop-name link opens this view. Credentials, approval reasoning, and private snapshots are excluded.

A suspended or banned seller's retained profile remains directly viewable, although that seller's products may be hidden or unpurchasable. A deleted seller has no live profile; past order items continue to show purchase-time shop evidence.

## REQ-SELLER-ACCOUNT-FUNCTIONS Seller approval and restriction operations

Seller approval is a reasoned administrator workflow separate from suspension and ban. Rejected sellers can submit a fresh request while prior decisions remain available. Suspension freezes new catalog commerce but deliberately leaves existing-order duties accessible.

Administrators receive a stable pending queue and can reverse suspension without recreating deleted catalog data or bypassing stock and variant rules.

### REQ-SELLER-ACCOUNT-FUNCTIONS-1 View seller approval status

The acting seller can view `pending`, `approved`, or `rejected` approval status. A rejected result includes its reason; pending and approved results do not.

Suspension and ban are reported separately. Another seller, or a banned or deleted seller, cannot use the query.

### REQ-SELLER-ACCOUNT-FUNCTIONS-2 Resubmit seller approval

A rejected seller may submit a new registration approval request. It becomes the current `pending` request while the earlier rejected request and reason remain retained. Profile and credentials do not change.

A seller that is not currently rejected, or one that is banned or deleted, is refused.

### REQ-SELLER-ACCOUNT-FUNCTIONS-3 List pending seller approvals

An administrator can view all current pending seller approval requests. Each result identifies the seller and current shop profile needed for review; approved and rejected requests are excluded.

The queue is paginated in oldest-pending-first order, with request identifier breaking equal-time ties. A caller without an administrator grade is refused.

### REQ-SELLER-ACCOUNT-FUNCTIONS-4 Approve a seller registration

An administrator may approve a pending request. The request and seller approval state become `approved`, the decision actor and time are retained, and the seller can view the outcome.

The seller may then create products unless separately suspended or banned. No rejection reason is attached. A non-pending request or non-administrator actor is refused.

### REQ-SELLER-ACCOUNT-FUNCTIONS-5 Reject a seller registration

An administrator may reject a pending request only with a nonempty reason. The request and seller approval state become `rejected`, and decision actor and time are retained.

The seller can view the reason and cannot sell. A later submission creates a new request. Missing reason, non-pending request, or non-administrator actor is refused.

### REQ-SELLER-ACCOUNT-FUNCTIONS-6 Suspend a seller

An administrator may suspend an approved seller. The platform immediately hides the seller's products from search and categories, blocks their purchase, and refuses product, variant, and image creation or editing. The seller may continue to view and edit the public seller profile.

The seller can still authenticate, ship existing paid items, and decide existing cancellation and refund requests unless separately banned. Orders and snapshots remain unchanged. A deleted or already suspended target, or a non-administrator actor, is refused.

### REQ-SELLER-ACCOUNT-FUNCTIONS-7 Unsuspend a seller

An administrator may clear a current suspension. Live products become visible and purchasable again, and catalog creation and edit authority returns when the seller is approved and not banned.

Unsuspension does not restore deleted products or override out-of-stock and no-variant unavailability. Orders and request history remain unchanged. A nonsuspended target or non-administrator actor is refused.

## REQ-CATEGORY-FUNCTIONS Category operations

Administrators maintain a strict two-level taxonomy, while customers browse its full hierarchy and product pages. Category deletion changes classification rather than product ownership or history.

Customer results use deterministic ordering. A selected category returns only its directly assigned products so a parent and each child remain distinct browsing destinations.

### REQ-CATEGORY-FUNCTIONS-1 Create a category

An administrator may create a category with a name and description. A top-level category has no parent; a subcategory has exactly one top-level parent and appears beneath it in customer browsing.

A missing field, non-administrator actor, or attempt to place a child beneath a subcategory is refused.

### REQ-CATEGORY-FUNCTIONS-2 Edit a category

An administrator may replace a category's name or description. Later category and product views use the new values, while the category keeps its level and parent relation and products remain assigned.

A non-administrator actor or nonexistent category is refused.

### REQ-CATEGORY-FUNCTIONS-3 Delete a category

Deleting a category uncategorizes every product assigned directly to it without deleting those products. Deleting a top-level category also deletes its subcategories and uncategorizes products assigned to the parent or any deleted child.

Products retain seller ownership and remain discoverable subject to other visibility rules. Existing product snapshots preserve their captured category. A non-administrator actor or nonexistent category is refused.

### REQ-CATEGORY-FUNCTIONS-4 Browse categories

An authenticated customer can view every top-level category with its direct subcategories, including each name and description. Top-level categories are ordered by name and then stable identifier; each parent's children use the same order.

`Uncategorized` is a product condition, not an administrator-managed category. An unauthenticated, banned, or deleted customer is refused.

### REQ-CATEGORY-FUNCTIONS-5 View products in a category

The platform returns visible live products assigned directly to the selected category in a paginated newest-first list. Selecting a parent does not implicitly include products assigned to its children, and every result uses the standard product card.

Deleted products and products of suspended or banned sellers are excluded. A live product with no variants remains visible as unavailable. A deleted or nonexistent category is refused.

## REQ-PRODUCT-FUNCTIONS Product operations

Product commands are seller-owned and admission-sensitive. Every successful edit captures the complete catalog aggregate, while deletion removes live catalog children only after active item and request obligations clear.

Administrators can inspect every seller's catalog and evidence. Their policy deletion crosses ownership and immediately removes violating merchandise from live commerce, while retained order, shipment, request, snapshot, and noncatalog variant evidence keeps earlier customer obligations resolvable.

### REQ-PRODUCT-FUNCTIONS-1 Create a product

An approved, nonsuspended, nonbanned seller may create a product owned by that seller with required name, description, retained category, and base price. The category may be top-level or a subcategory.

The product begins with no images and no variants and therefore appears as unavailable until a variant is added. Incomplete input, invalid price, deleted category, or an ineligible seller state is refused.

### REQ-PRODUCT-FUNCTIONS-2 Edit a product

The owning eligible seller may change name, description, category, or base price. Later listings use the new values, while existing order items keep their purchase-time copies.

Every successful edit creates a complete product snapshot containing all product fields, ordered images, and every current variant. A nonowner or ineligible seller, deleted category, or invalid value is refused.

### REQ-PRODUCT-FUNCTIONS-3 Delete an owned product

The owner may delete a product only when none of its variants has a `paid` or `shipped` item and none has a pending cancellation or refund request. Otherwise, deletion is refused.

Successful deletion removes the product, variants, images, and inventory records from the live catalog, removes wishlist entries, and makes cart references unavailable. Order items and immutable snapshots remain preserved.

### REQ-PRODUCT-FUNCTIONS-4 View own product snapshots

The seller can inspect complete snapshots of an owned product in newest-change-first order. Each shows change time, changed elements, before-and-after values, ordered images, and the contemporaneous variant set.

Snapshots remain viewable after live product deletion while the seller account exists. Another seller, or a banned or deleted owner, is refused.

### REQ-PRODUCT-FUNCTIONS-5 List and view all products

An administrator can list every live product in paginated newest-created-first order and open its full details. Results include products of pending, rejected, suspended, or banned sellers, and uncategorized, unavailable, or out-of-stock products.

Each product identifies its seller and moderation-relevant state. A non-administrator is refused.

### REQ-PRODUCT-FUNCTIONS-6 View any product snapshots

An administrator can inspect complete snapshots of any current or deleted product in newest-change-first order. Each exposes time, changed elements, before-and-after values, all product fields, ordered images, and the contemporaneous variant set.

Seller ownership and live product deletion do not remove this oversight access. A non-administrator is refused.

### REQ-PRODUCT-FUNCTIONS-7 Delete a policy-violating product

An administrator may target any seller's current product and submit a nonempty policy-violation reason. The reason, administrator, and deletion time become immutable moderation history. The product, images, selectable variants, working inventory history, and wishlist memberships leave live commerce immediately; cart references become unavailable.

Paid or shipped items and pending cancellation or refund requests do not block this moderation path. Existing order items, shipments, snapshots, and requests remain usable for fulfillment or resolution. Deletion alone creates no refund or stock restoration; ordinary seller decisions and administrator force actions keep their own rules. A later valid restoration record does not recreate merchandise.

Missing or whitespace-only reason, non-administrator actor, or nonexistent or already deleted product is refused.

## REQ-PRODUCT-IMAGE-FUNCTIONS Product image operations

Images form one ordered collection within a seller-owned product. The first retained image is always the listing thumbnail. Upload, reorder, and delete each change that aggregate and therefore create a complete product snapshot.

### REQ-PRODUCT-IMAGE-FUNCTIONS-1 Upload product images

The owning eligible seller may upload one or more images. They are appended after the existing image sequence; if the collection was empty, the first upload becomes the thumbnail. Product detail shows every retained image.

The complete product state is snapshotted. A nonowner or suspended, banned, or deleted seller, deleted product, or invalid image upload is refused.

### REQ-PRODUCT-IMAGE-FUNCTIONS-2 Reorder product images

The owner may submit the complete order of retained images. Each retained image must appear exactly once. The platform applies that order, product lists use the new first image as thumbnail, and a complete snapshot captures the before-and-after ordering.

A missing, duplicate, or foreign image, deleted product, nonowner, or ineligible seller is refused.

### REQ-PRODUCT-IMAGE-FUNCTIONS-3 Delete a product image

The owner may delete one image. Remaining images keep their relative order; if the first image was removed, the next retained image becomes thumbnail. Removing the last image leaves no thumbnail.

Product detail and listings stop showing the deleted image, and a complete product snapshot is created. A foreign or missing image, deleted product, nonowner, or ineligible seller is refused.

## REQ-VARIANT-FUNCTIONS Product variant operations

Variants are seller-owned SKU combinations beneath a product. Creation establishes identity and pricing but starts with no stock; editing changes catalog content with complete aggregate evidence; deletion removes the live SKU and inventory only after commercial obligations clear.

### REQ-VARIANT-FUNCTIONS-1 Add a product variant

The owning eligible seller may add a variant with a required unique SKU code, option values, an optional price override, and stock starting at `0`. The child belongs to that product and seller.

Its effective price uses the override when present and otherwise the product base price. Stock changes only through inventory movements. The first variant removes the product's no-variant condition, although positive stock is still required for purchase. Invalid fields, duplicate SKU, deleted product, nonowner, or ineligible seller is refused.

### REQ-VARIANT-FUNCTIONS-2 Edit a product variant

The owner may change SKU code, option values, or the optional price override. A complete product snapshot captures the edited variant's before-and-after values, the ordered images, and every other contemporaneous variant.

Stock and inventory history do not change, and existing order items keep purchase-time facts. Duplicate SKU, invalid value, deleted target, nonowner, or ineligible seller is refused.

### REQ-VARIANT-FUNCTIONS-3 Delete a product variant

The owner may delete a variant only when it has no `paid` or `shipped` item and no pending cancellation or refund request. Successful deletion removes the live SKU and inventory history, and saved cart references become unavailable.

Order and snapshot evidence remains. If it was the final variant, the product remains visible as unavailable. A nonowner, banned or deleted seller, missing target, or active blocker is refused.

## REQ-INVENTORY-FUNCTIONS Inventory operations

Sellers change stock only by appending reasoned movements to an owned variant's ledger. Restock records a positive change; adjustment or loss records a negative change. The full history explains the current sum and all automatic commerce movements.

### REQ-INVENTORY-FUNCTIONS-1 Restock a variant

The owning seller submits a positive restock quantity and a nonempty reason. The platform appends a timestamped positive movement to that variant, increasing current stock by exactly the quantity.

A zero-to-positive result makes the variant available when its product and seller are otherwise eligible. A nonowner, banned or deleted seller, deleted variant, nonpositive quantity, or empty reason is refused.

### REQ-INVENTORY-FUNCTIONS-2 Subtract inventory

The owning seller submits a positive adjustment or loss magnitude and a nonempty reason. The platform stores its negative as the movement and decreases current stock by exactly that magnitude.

A zero result marks the variant out of stock and updates cart availability. A subtraction that would make stock negative is refused, as is a nonpositive magnitude, empty reason, deleted variant, nonowner, or banned or deleted seller.

### REQ-INVENTORY-FUNCTIONS-3 View variant inventory history

The owner can view calculated current stock and the full movement history in paginated newest-first order. Every record shows signed quantity, reason, and timestamp and includes seller restocks and adjustments and automatic purchase, cancellation, and refund causes.

Current stock equals the sum of the complete ledger, including records outside the current page. Another seller, a banned or deleted owner, or a deleted variant is refused.

## REQ-PRODUCT-DISCOVERY Product discovery journey

Authenticated customers discover live products across sellers through one consistent search, category, card, and detail vocabulary. Search combines name, category, price, and stock criteria and applies one requested order before stable pagination.

Cards support comparison; detail supports a purchase decision. Moderated live products leave public lists but remain directly inspectable as unavailable, while deletion removes the live detail.

### REQ-PRODUCT-DISCOVERY-1 Search the product catalog

Search performs case-insensitive substring matching on product name across visible live products from all eligible sellers. Optional filters combine with logical AND:

- category matches the product's direct assignment;
- inclusive minimum and maximum price match when at least one variant's effective price is in range, or use base price when no variant exists;
- in-stock only requires at least one variant with positive calculated stock.

Results are paginated. Sort is newest creation first, lowest displayed price ascending, or lowest displayed price descending, with product identifier breaking equal-key ties. Deleted products and products of suspended or banned sellers are excluded.

An invalid price interval, unknown category, unsupported sort, or unavailable customer identity is refused.

### REQ-PRODUCT-DISCOVERY-2 Compare product cards

Every search and category card shows:

- first retained image as thumbnail, or no image when the collection is empty;
- product name;
- base price for no variants, one effective price when variants agree, or the minimum-to-maximum effective price range;
- seller shop name; and
- average rating when non-deleted reviews exist.

The non-deleted review count accompanies the average. A product with no variants is marked unavailable.

### REQ-PRODUCT-DISCOVERY-3 View product details

The live detail returns all ordered images, name, description, category, linked seller profile, every live variant with effective price and stock status, average rating, total non-deleted review count, and all non-deleted reviews newest publication first. Reviews use `deleted user` attribution after author closure.

A live product of a suspended or banned seller remains directly viewable but is marked unavailable and cannot be purchased. A deleted product has no live detail. A missing/deleted product or unavailable customer identity is refused.

## REQ-WISHLIST-FUNCTIONS Wishlist operations

The wishlist saves live products, never variants or quantities. It tolerates temporary unavailability and displays current catalog state, while product deletion cleans the relation automatically.

Add is idempotent, viewing is self-scoped and stably paginated, and explicit removal changes no commerce record.

### REQ-WISHLIST-FUNCTIONS-1 Add a product to the wishlist

The platform creates a relation between the acting customer and selected live product. If that relation already exists, the request succeeds without a duplicate or saved-time change.

No SKU, quantity, price, or stock reservation is created. A live unavailable product—including one from a suspended or banned seller—may be saved through its direct detail. A deleted/missing product or unavailable customer identity is refused.

### REQ-WISHLIST-FUNCTIONS-2 View the wishlist

The platform returns the acting customer's saved products in paginated newest-saved-first order using current product-card values. Products that are out of stock, have no variants, or belong to suspended or banned sellers remain in the list but are marked unavailable.

Deleted products are absent because product deletion removes their entries. Another customer's entries are never returned, and an unavailable customer identity is refused.

### REQ-WISHLIST-FUNCTIONS-3 Remove a wishlist product

The customer may remove one owned product relation. Later wishlist views omit it, while the product, other customers' wishlists, cart, stock, and orders remain unchanged.

A relation not owned by the acting customer or an unavailable customer identity is refused.

## REQ-CART-FUNCTIONS Shopping cart operations

Customers build carts from specific live variants and positive quantities. Adds combine by SKU, quantity changes replace the saved request, and neither operation reserves stock or fixes price.

The cart reports current prices and availability. It permits a requested quantity above current positive stock so the customer can see and correct a shortage, but checkout revalidates every line.

### REQ-CART-FUNCTIONS-1 Add a variant to the cart

The customer selects a live variant and positive quantity. If no line exists, the platform creates one; otherwise it adds the quantity to the existing line. The product and seller must be purchasable and current stock must be positive.

A positive resulting quantity above stock is retained with a shortage warning. No inventory is reserved, and the effective price is not fixed. Nonpositive quantity, deleted/out-of-stock variant, moderated/deleted seller or product, or unavailable customer identity is refused.

### REQ-CART-FUNCTIONS-2 View the shopping cart

The platform returns every owned line with product name, option values, current effective unit price, requested quantity, subtotal, and live status. Subtotal is unit price times quantity, and cart total sums all saved line subtotals.

Stock below quantity produces a shortage warning. A deleted or zero-stock variant, or a deleted, suspended, or banned product owner, produces an unavailable marker. Another customer's cart or unavailable identity is refused.

### REQ-CART-FUNCTIONS-3 Change cart quantity

The customer may replace an owned line's quantity with a positive value. Subtotal and total recalculate using current effective price. A quantity above stock remains saved with a shortage warning and changes no inventory.

Zero does not implicitly remove the line; the explicit remove command does. Nonpositive quantity, missing/foreign line, or unavailable customer identity is refused.

### REQ-CART-FUNCTIONS-4 Remove a cart line

The customer may delete one owned line. Other lines remain, and the total recalculates without that subtotal.

The product, stock, wishlist, and orders are unchanged. A missing/foreign line or unavailable customer identity is refused.

## REQ-CHECKOUT-JOURNEY Checkout and order placement journey

Checkout converts currently eligible cart lines into one reviewed, paid, multi-seller order. Unavailable lines stay in the cart. The selected destination, live prices, quantities, stock, products, and sellers are revalidated at confirmation so the customer is never charged for a silently changed summary.

A temporary availability hold protects the external payment attempt from overselling without posting inventory early. Failure releases the hold and preserves retry state; success atomically commits the order, evidence, stock movements, and purchased-line removal exactly once.

### REQ-CHECKOUT-JOURNEY-1 Start checkout

The platform forms a candidate from all cart lines that are currently purchasable in their full requested quantity. Unavailable and short-stock lines are excluded and remain in the cart. At least one eligible line is required.

The customer selects a retained owned address or uses the existing default. No order, hold, or inventory movement is created yet. Checkout is refused without an eligible line or an owned address.

### REQ-CHECKOUT-JOURNEY-2 Review the order summary

The summary shows every eligible product and variant, quantity, current effective unit price, subtotal, complete selected shipping address, and total. Total is the sum of item subtotals.

The shown address becomes immutable only if the order succeeds. A price, stock, product/seller eligibility, cart quantity, or address change before confirmation invalidates the summary and requires a refreshed review. Unavailable lines remain outside it.

### REQ-CHECKOUT-JOURNEY-3 Confirm and initiate payment

Confirmation revalidates every reviewed price, quantity, stock balance, product, seller, and address. Any change refuses payment initiation and returns a refreshed summary.

When all facts still match, the platform places a temporary hold against each variant's available-to-purchase quantity and starts one external payment attempt for the reviewed total. A hold is not an inventory movement. One payment-attempt identifier can create at most one all-or-nothing order across every selected item and seller.

### REQ-CHECKOUT-JOURNEY-4 Recover from payment failure

If the gateway reports failure, the platform creates no order, item, purchase snapshot, or inventory movement. It releases every temporary hold and preserves the cart.

The customer can refresh the summary and retry with a new payment-attempt identifier. The failed identifier is final and cannot later create an order.

### REQ-CHECKOUT-JOURNEY-5 Create the paid order

For a successful current held attempt, the platform atomically creates one order and one `paid` item per distinct purchased variant. The order records unique number, purchase time, total, customer, immutable address, and each item's seller.

Each item fixes quantity and effective unit price. Its product copy preserves name and description, its variant copy preserves options and price, and its seller-profile copy preserves shop name and logo. Repeated success notification for the same attempt returns the already-created outcome and cannot duplicate the order.

An unknown, released, or otherwise finalized attempt cannot create another order.

### REQ-CHECKOUT-JOURNEY-6 Commit stock and cart effects

Successful order creation consumes the temporary holds, posts one negative purchase inventory movement per item's quantity, and removes only the purchased cart lines. Unavailable or otherwise unpurchased lines remain.

The order, items, address and purchase snapshots, inventory movements, and cart removals commit together. If any part cannot commit, none of these records or changes becomes visible.

## REQ-ORDER-HISTORY-FUNCTIONS Customer order history

Order history combines immutable purchase facts with current derived fulfillment and after-sales states. The customer first browses stable purchase headers, then inspects item snapshots and package tracking without depending on live products or seller accounts.

### REQ-ORDER-HISTORY-FUNCTIONS-1 List customer orders

The platform returns every order owned by the acting customer in paginated newest-purchase-first order, with order number breaking equal purchase times. Each row shows order number, date, total price, and current derived overall status.

All retained orders are reachable through pagination. Another customer's order or an unavailable customer identity is refused.

### REQ-ORDER-HISTORY-FUNCTIONS-2 View order details

The customer can view every order item with purchase-time product name, selected variant options, quantity, fixed unit price, and current item status, plus the complete immutable shipping address. Order total and current derived overall status are included.

Product, variant, and seller values come from purchase snapshots, so live deletion does not remove them. Cancellation and refund history remains linked. A foreign order or unavailable customer identity is refused.

### REQ-ORDER-HISTORY-FUNCTIONS-3 View order shipments

The order view returns every shipment with its seller, carrier, tracking number, shipping time, delivery state, and exact included items. Different sellers appear in separate packages, while every item in one package shares its tracking.

An unshipped item remains in order details without a shipment. Cancelled or refunded items retain earlier shipment history. A foreign order or unavailable customer identity is refused.

## REQ-SHIPPING-FUNCTIONS Shipping and delivery operations

Sellers work from an ownership-scoped queue of paid items and choose same-seller package groupings. Package creation moves the whole selected set to shipped with shared tracking.

Customers inspect and confirm packages through their orders. If they do not, the platform applies the same package-wide delivery result fourteen days after shipping.

### REQ-SHIPPING-FUNCTIONS-1 List items awaiting shipment

The platform returns the acting seller's `paid` order items in paginated oldest-paid-first order, with order-item identifier breaking equal paid times. Each row identifies order, customer destination, product and variant snapshot, quantity, and paid time.

Only that seller's items appear; shipped, delivered, cancelled, and refunded items do not. Suspended sellers retain the queue, while banned or deleted sellers cannot access it.

### REQ-SHIPPING-FUNCTIONS-2 Create a shipment

The seller selects one or more `paid` items owned by that seller, each without a pending cancellation request, and enters carrier and tracking number. The platform records shipping time, creates one package, shares its tracking across the selection, links every item to it, and changes every selected item to `shipped`.

The operation changes the entire set or none. A pending cancellation must first be approved or rejected so shipping cannot strand an undecidable request. Empty selection, foreign, non-paid, already assigned, or cancellation-pending item, missing tracking input, or a banned/deleted seller is refused.

### REQ-SHIPPING-FUNCTIONS-3 View shipment tracking

The purchasing customer can open each owned package from order details and see seller, carrier, tracking number, shipping time, delivery state, and included items. Every included item shares the package values.

Historical tracking remains after an item is cancelled or refunded. Another customer's shipment or an unavailable customer identity is refused.

### REQ-SHIPPING-FUNCTIONS-4 Confirm shipment delivery

The purchasing customer may confirm one currently shipped package. Every item in it that is still `shipped` becomes `delivered` at the confirmation time; confirmation is not item-by-item.

Each delivered item's seven-day refund window begins, and the overall order status recalculates. Another customer, a package no longer currently shipped, or an unavailable identity is refused.

### REQ-SHIPPING-FUNCTIONS-5 Auto-confirm shipment delivery

Fourteen days after shipping, an unconfirmed package automatically changes every still-`shipped` item to `delivered` and records the deadline as delivery time. An item already cancelled or refunded by administrator force action is not relabeled.

Each newly delivered item's refund window begins, and the overall order status recalculates.

## REQ-CANCELLATION-FUNCTIONS Order item cancellation journey

Cancellation is a purchaser-to-item-seller workflow available only before shipment. The seller works from a stable pending queue and either rejects with no commercial effect or approves an atomic item-state, evidence, refund, and stock restoration commit.

### REQ-CANCELLATION-FUNCTIONS-1 Request item cancellation

The purchasing customer submits a nonempty text reason for one owned item currently in `paid`. The platform creates a `pending` cancellation request; the item stays paid and no other item is included.

The customer can view the pending result. A non-purchaser, non-paid item, another pending request, empty reason, or unavailable customer identity is refused. A later retry follows the rejection-and-one-pending policy.

### REQ-CANCELLATION-FUNCTIONS-2 List pending cancellations

The platform returns pending requests for the acting seller's items in paginated oldest-request-first order, with request identifier breaking equal creation times. Each row shows reason, customer, order and item snapshot, quantity, and request time.

Approved/rejected and other sellers' requests are excluded. A suspended seller retains access; a banned or deleted seller does not.

### REQ-CANCELLATION-FUNCTIONS-3 Approve item cancellation

The target item's seller may approve its pending request while the item is still paid. Request and item eligibility are revalidated together; the request becomes `approved`, the item becomes `cancelled`, and an immutable decision snapshot is created.

The customer can view the result and all commercial effects commit with it. A different seller, non-pending request, non-paid item, or banned/deleted seller is refused.

### REQ-CANCELLATION-FUNCTIONS-4 Reject item cancellation

The target item's seller may reject its pending request while the item is still paid. The request becomes `rejected`, the item remains paid, and a decision snapshot is created.

No refund or inventory movement occurs, the customer can view the result, and the seller may still ship. A different seller, non-pending request, non-paid item, or banned/deleted seller is refused.

### REQ-CANCELLATION-FUNCTIONS-5 Commit approved cancellation effects

Approval refunds only the target item and posts a positive cancellation-restoration movement equal to its purchased quantity. Other order items remain unchanged, and the derived overall order status recalculates.

Request/item transitions, decision snapshot, refund, inventory movement, and derived state commit together. If any part fails, none becomes visible.

## REQ-REVIEW-FUNCTIONS Review operations

Review commands are author-owned and tied to a delivered customer-product-order opportunity. Publication contributes current public feedback, editing replaces live values with history, and deletion retires the contribution while preserving its identity and snapshots.

### REQ-REVIEW-FUNCTIONS-1 Publish a product review

The purchasing customer may submit a required rating from `1` through `5` and optional text for a retained product when the selected owned order contains a delivered item for that product and no review identity exists for the tuple.

The review appears newest first and updates average rating and non-deleted count. A non-purchaser, absent delivered item, duplicate tuple, invalid rating, deleted product, or unavailable customer identity is refused.

### REQ-REVIEW-FUNCTIONS-2 Edit an authored review

The author may change a live review's rating or optional text. Rating remains within `1` through `5`; text may be added, replaced, or cleared. Product average recalculates while original publication order remains.

An immutable snapshot preserves before-and-after rating and text. A nonauthor, deleted review or product, invalid rating, or unavailable author identity is refused.

### REQ-REVIEW-FUNCTIONS-3 Delete an authored review

The author may remove the live review from product display and rating aggregates. Average and count recalculate immediately, while every immutable review snapshot remains.

The customer-product-order identity stays retired, so no later edit or recreation is available for that tuple. Other reviews remain unchanged. A nonauthor, already deleted review, or unavailable author identity is refused.

## REQ-REFUND-FUNCTIONS Delivered-item refund journey

Refund is a purchaser-to-item-seller workflow that begins only after delivery and within seven days. The seller works from a stable pending queue and either rejects without changing the delivered item or approves an atomic item-state, evidence, refund, and stock-restoration commit.

### REQ-REFUND-FUNCTIONS-1 Request an item refund

Within seven days of recorded delivery, the purchasing customer submits a nonempty text reason for one owned `delivered` item. The platform creates a `pending` refund request; the item stays delivered and no other item is included.

The customer can view the pending result. A non-purchaser, non-delivered item, late or duplicate request, empty reason, or unavailable customer identity is refused. Retry remains subject to one pending request and the original delivery deadline.

### REQ-REFUND-FUNCTIONS-2 List pending refunds

The platform returns pending requests for the acting seller's items in paginated oldest-request-first order, with request identifier breaking equal creation times. Each row shows reason, customer, order and item snapshot, quantity, delivery time, and request time.

Approved/rejected and other sellers' requests are excluded. A suspended seller retains access; a banned or deleted seller does not.

### REQ-REFUND-FUNCTIONS-3 Approve an item refund

The target item's seller may approve its pending request while the item is still delivered. Request and item eligibility are revalidated together; the request becomes `approved`, the item becomes `refunded`, and an immutable decision snapshot is created.

The customer can view the result and all commercial effects commit with it. A different seller, non-pending request, non-delivered item, or banned/deleted seller is refused.

### REQ-REFUND-FUNCTIONS-4 Reject an item refund

The target item's seller may reject its pending request while the item is still delivered. The request becomes `rejected`, the item remains delivered, and a decision snapshot is created.

No refund or inventory movement occurs, the customer can view the result, and shipment/delivery evidence remains unchanged. A different seller, non-pending request, non-delivered item, or banned/deleted seller is refused.

### REQ-REFUND-FUNCTIONS-5 Commit approved refund effects

Approval refunds only the target item and posts a positive refund-restoration movement equal to its purchased quantity. Other order items remain unchanged, and the derived overall order status recalculates.

Request/item transitions, decision snapshot, refund, inventory movement, and derived state commit together. If any part fails, none becomes visible.

## REQ-SELLER-DASHBOARD Seller dashboard and order-item reports

The seller dashboard is scoped to the acting shop. Its summary separates catalog size and retained sales volume from the two pending request workloads, while the order-item report supplies the underlying fulfillment detail.

Suspension does not remove these views because the seller must still process existing orders. A ban or deletion does remove access. Reported order lines follow their purchase-time seller snapshot, so later catalog changes never erase commercial history.

### REQ-SELLER-DASHBOARD-1 View the shop summary

The seller can view one current summary containing:

- total non-deleted products they own, including products that are currently unavailable;
- total retained order items attributed to their shop snapshot, across every item status;
- pending cancellation requests for those items; and
- pending refund requests for those items.

All four values describe the same reporting moment. Completed or rejected requests no longer contribute to a pending measure, while deleted products leave the product total without removing their historical order items. A suspended seller retains this view; a banned or deleted seller does not.

### REQ-SELLER-DASHBOARD-2 List shop order items

The seller can page through every retained order item attributed to their shop and optionally select exactly one status: `paid`, `shipped`, `delivered`, `cancelled`, or `refunded`. Omitting the filter includes all five states.

Each row identifies the order and item, customer destination needed for fulfillment, purchase-time product and variant values, quantity, fixed unit price, current item status, and purchase time. Results are newest-purchase-first, with order-item identifier breaking equal times.

Product deletion does not remove a historical row. A suspended seller retains access, while an unsupported filter or a banned or deleted seller is refused.

## REQ-ADMIN-REQUEST-FUNCTIONS Administrator application operations

Administrator authority is added to an existing customer or seller identity. An ordinary user enters the journey with a reason, follows only their own application history, and either remains ordinary after rejection or gains the regular administrator grade after approval.

Super administrators alone see and decide the platform-wide pending queue. Decisions are final for the selected request and retain attribution; a later permitted application is a new record rather than a reopened rejection.

### REQ-ADMIN-REQUEST-FUNCTIONS-1 Submit an administrator application

A customer or seller who has no administrator grade can submit a nonempty text reason. The platform creates a `pending` request linked to that identity, records the reason and creation time, and returns its identifier and status.

Submission does not change credentials, commercial history, or authority. A rejected prior request permits a later new application, but an empty reason, unavailable account, current regular or super administrator, or another pending request for the applicant is refused.

### REQ-ADMIN-REQUEST-FUNCTIONS-2 View personal application history

The applicant can page through only their own requests, newest creation first. Each entry shows the submitted reason, creation time, and `pending`, `approved`, or `rejected` status. A decided entry also shows decision time; a pending entry does not.

Request identifier breaks equal creation times. Earlier rejected requests remain visible beside later applications. Access to another identity's request, or access by a banned or deleted applicant, is refused.

### REQ-ADMIN-REQUEST-FUNCTIONS-3 List pending administrator applications

A super administrator can page through the platform-wide pending queue, oldest creation first. Each row includes request identifier, whether the applicant is a customer or seller, the applicant identity, submitted reason, and creation time. Request identifier breaks equal times.

Approved and rejected records do not appear in this work queue. A regular administrator or actor without a current super grade is refused, even if that actor is viewing their own underlying identity.

### REQ-ADMIN-REQUEST-FUNCTIONS-4 Approve an administrator application

A super administrator may approve one `pending` request. In one commit, the request becomes `approved`, records decision actor and time, and grants `regularAdministrator` to the applicant's existing customer or seller identity. The applicant can see the result immediately.

Credentials and commercial history remain unchanged, and approval does not grant `superAdministrator`. A non-super actor, a request no longer pending, or a deleted applicant identity is refused; no partial grade grant or request transition remains.

### REQ-ADMIN-REQUEST-FUNCTIONS-5 Reject an administrator application

A super administrator may reject one `pending` request. It becomes `rejected`, records decision actor and time, grants no administrator grade, and is visible to the applicant.

The decision is final for that record, but a still-eligible applicant may later submit a new request. A non-super actor or a request no longer pending is refused.

## REQ-ADMIN-GRADE-FUNCTIONS Administrator grade change operations

Grade changes apply to authority carried by an existing customer or seller identity. Promotion adds the super grade; demotion removes that exact grade and leaves the regular grade in place. Neither command replaces credentials, identity, or commercial history.

Only a current super administrator may make either change. Every successful change remains attributable to acting administrator, target, action, and time.

### REQ-ADMIN-GRADE-FUNCTIONS-1 Promote a regular administrator

A super administrator may promote a different eligible regular administrator. The target keeps `regularAdministrator`, gains `superAdministrator`, and can immediately decide administrator applications and perform later grade changes.

The target's underlying customer or seller identity, credentials, and history remain unchanged. The action records actor, target, promotion, and time. A non-super actor, a target without the regular grade, an existing super administrator, or a banned or deleted target is refused.

### REQ-ADMIN-GRADE-FUNCTIONS-2 Demote another super administrator

A super administrator may demote another current super administrator. The target loses `superAdministrator`, retains `regularAdministrator`, and immediately loses application-decision and grade-change powers while keeping regular platform oversight.

Identity, credentials, history, and any separate ban state remain unchanged. A banned target may be demoted because this command removes authority; a deleted target cannot. A non-super actor, non-super target, or self-demotion attempt is refused. The successful action records actor, target, demotion, and time.

## REQ-USER-OVERSIGHT Customer and seller account oversight

Administrators inspect current customer and seller populations separately because the account facts and ban consequences differ. Customer and seller bans both end authentication without deleting history; seller bans additionally hide products and pause the seller's access to existing-order work until recovery.

Moderation respects administrator hierarchy. No administrator may target their own underlying identity. A regular administrator cannot ban or unban a super administrator, while a super administrator may moderate a different super holder. The grade remains attached during a ban but cannot be exercised because every session is revoked.

### REQ-USER-OVERSIGHT-1 List customer accounts

An administrator can page through all non-deleted customer accounts, including banned accounts, newest registration first. Each row contains customer identifier, email, display name, registration time, active or banned login state, and current administrator grades. Customer identifier breaks equal registration times.

A deleted customer's credentials and profile have ceased to be an account row. Their retained orders and `deleted user` reviews remain reachable through order and product oversight. A caller without regular or super administrator authority is refused.

### REQ-USER-OVERSIGHT-2 Ban a customer

An administrator may ban a current customer. The login state becomes banned and every active session is revoked immediately, so valid credentials cannot start or continue access.

The profile, addresses, wishlist, cart, orders, requests, reviews, snapshots, and administrator grades remain unchanged. The action records actor, target, before-and-after login state, and time. A super administrator may ban another super administrator's customer identity, but a non-administrator, self-target, already banned or deleted customer, or regular administrator targeting a super administrator is refused.

### REQ-USER-OVERSIGHT-3 Unban a customer

An administrator may return a banned customer to active login state. Valid credentials can create a new session afterward, but sessions revoked by the ban do not revive.

Profiles, commerce records, reviews, credentials, and administrator grades otherwise remain unchanged. The action records actor, target, state change, and time. A non-administrator, self-target, customer not currently banned, deleted customer, or regular administrator targeting a super administrator is refused.

### REQ-USER-OVERSIGHT-4 List seller accounts

An administrator can page through all non-deleted seller accounts, newest registration first. Pending, rejected, approved, suspended, and banned sellers are included.

Each row contains seller identifier, email, current shop name, registration time, approval state, separate suspension and ban states, and administrator grades. Seller identifier breaks equal times. Deleted sellers are absent as account rows, while their purchase snapshots remain in order oversight. A non-administrator is refused.

### REQ-USER-OVERSIGHT-5 Ban a seller

An administrator may ban a current seller. The seller's sessions are revoked, later login is blocked, and live products are hidden and unpurchasable. Until unbanned, the seller also cannot log in to ship or decide cancellation and refund requests.

Existing orders, items, shipments, requests, inventory history, snapshots, and purchase-time shop values remain unchanged. The action records actor, target, login-state change, and time. A different super administrator may ban a super holder's seller identity; a non-administrator, self-target, already banned or deleted seller, or regular administrator targeting a super administrator is refused.

### REQ-USER-OVERSIGHT-6 Unban a seller

An administrator may restore authentication eligibility to a banned seller. Revoked sessions stay terminated; the seller must log in again. Approval and suspension states do not change:

- an approved, nonsuspended seller's live products become visible and purchasable subject to product, variant, and stock rules;
- a suspended seller remains hidden and catalog-restricted but can again process existing orders after login; and
- a pending or rejected seller remains unable to sell.

The action records actor, target, state change, and time. A non-administrator, self-target, seller not currently banned, deleted seller, or regular administrator targeting a super administrator is refused.

## REQ-ORDER-OVERSIGHT Administrator order oversight

Administrators work across the whole order population rather than through customer ownership or seller-line scope. A platform directory leads to complete retained order detail, including the purchase values, fulfillment, customer requests, and administrative actions needed to resolve disputes.

Forced cancellation and refund remain item-based even when initiated for an order. The order command selects every item eligible for that action, leaves other lines unchanged, and recalculates the derived status from the resulting mixture. All commercial effects succeed together.

### REQ-ORDER-OVERSIGHT-1 List platform orders

An administrator can page through all orders newest creation first. Optional filters are derived overall status, customer identity, seller participation, and inclusive creation date range; supplied filters intersect.

Each row shows order identifier and number, customer identifier or deleted-user marker, creation time, fixed total, derived status, item count, and participating-seller count. A seller matches when at least one retained order item carries that seller's snapshot. Order identifier breaks equal times, and later customer or seller deletion does not remove a row.

An unsupported status, inverted date range, or actor without an administrator grade is refused.

### REQ-ORDER-OVERSIGHT-2 View a platform order

An administrator can open any order and see its immutable shipping address, fixed total, derived status, and every item. Each item includes purchase-time product, variant, seller, unit price, quantity, current status, cancellation or refund history, and any associated stock restoration.

Every shipment shows seller, carrier, tracking number, shipping and delivery times, and included items. Deleted customer, seller, product, and variant facts come from retained identifiers or snapshots rather than removed live profiles.

Forced-action history identifies administrator, policy reason, time, affected items, and outcome. A nonexistent order or non-administrator actor is refused.

### REQ-ORDER-OVERSIGHT-3 Force-cancel one order item

An administrator supplies a nonempty policy reason for one item currently `paid` or `shipped`. The item becomes `cancelled`, the customer is refunded for that line, and a positive inventory record restores the purchased quantity. Other items do not change, and the overall status recalculates.

If that item has a pending cancellation request, the request becomes `approved` with an immutable decision snapshot attributed to the administrator; no request is invented when none exists. Prior shipment tracking stays as history.

The action records actor, reason, time, prior state, and resulting state. Transition, request decision, refund, stock movement, and recalculation commit together. Missing reason, a `delivered`, `cancelled`, or `refunded` item, failed refund, absent item, or non-administrator is refused.

### REQ-ORDER-OVERSIGHT-4 Force-cancel an order's eligible items

An administrator supplies one nonempty policy reason for an order. Every item currently `paid` or `shipped` is selected; the administrator cannot choose a smaller subset through this command. Each selected item becomes `cancelled`, receives its line refund, and posts a quantity-matching stock restoration.

Any pending cancellation for a selected item becomes `approved` with its own decision snapshot. `delivered`, already `cancelled`, and already `refunded` lines remain unchanged. The same actor, reason, and time are recorded for every affected line.

At least one item must qualify. All item and request transitions, customer refunds, inventory movements, and the one derived-status recalculation commit together or none does. A missing reason, absent order, no qualifying line, any failed refund, or non-administrator is refused.

### REQ-ORDER-OVERSIGHT-5 Force-refund one order item

An administrator supplies a nonempty policy reason for one item currently `paid`, `shipped`, or `delivered`. The item becomes `refunded`, the customer receives its line amount, a positive inventory record restores purchased quantity, and overall order status recalculates.

A pending refund request becomes `approved` with an immutable administrator-attributed decision snapshot; no request is invented otherwise. Shipment, delivery, purchase snapshots, and published review history remain intact.

Transition, request decision, refund, inventory movement, and recalculation commit together. Missing reason, a `cancelled` or already `refunded` item, a pending cancellation conflict, failed refund, absent item, or non-administrator is refused.

### REQ-ORDER-OVERSIGHT-6 Force-refund an order's eligible items

An administrator supplies one nonempty policy reason for an order. Every `paid`, `shipped`, or `delivered` item is selected and becomes `refunded`; each receives its line refund and matching stock restoration. `cancelled` and already `refunded` lines remain unchanged.

Pending refund requests for selected items become `approved` with separate decision snapshots. The same actor, reason, and time are recorded across the affected set. At least one item must qualify, and any eligible item with a pending cancellation blocks the whole command.

All item and request transitions, refunds, inventory records, and derived-status recalculation commit together or none does. Missing reason, absent order, no eligible line, a pending cancellation conflict, any failed refund, or non-administrator is refused.

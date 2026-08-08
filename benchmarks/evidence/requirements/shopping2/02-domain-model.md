# Domain Model

This document defines the business meaning, information, relationships, states, and deletion effects of the shopping platform's concepts. Operations and refusals are owned by the functional and business-rule documents.

## REQ-CUSTOMER-PROFILE-DOMAIN Customer profile model

A customer profile is the personal presentation and contact information attached to one active customer identity. It is separate from credentials and from commercial records: changing a profile cannot change who owns an order, and deleting it must not erase preserved purchase history.

The profile's two editable values share one lifecycle. Its display name represents the active shopper to other readers where customer identity is appropriate, while its phone number is contact information. Customer closure removes both, and retained reviews and orders use their own historical or anonymous presentation.

### REQ-CUSTOMER-PROFILE-DOMAIN-1 Define customer profile information

Each customer profile contains:

- `display name`: the customer-facing name available while the account is active;
- `phone number`: the customer's editable contact number.

Email and password are credentials, not profile fields. Orders, order snapshots, and review history are also separate business records. Deleting the customer account removes both profile values.

### REQ-CUSTOMER-PROFILE-DOMAIN-2 Relate a profile to its customer

Each active customer identity owns exactly one customer profile, and a profile belongs to exactly one customer. Another customer cannot share or take ownership of it.

Editing the profile leaves the owning identity unchanged. Orders and reviews keep their purchase and authorship relationships independently of the profile.

### REQ-CUSTOMER-PROFILE-DOMAIN-3 Remove profile data at customer closure

When the owning customer account is deleted, its profile and the display name and phone number in that profile cease to be available. This effect is part of account closure and cannot be applied independently.

Preserved orders remain readable without the profile. Reviews that remain published show `deleted user` instead of the removed display name, and seller or administrator commercial history does not expose the removed phone number.

## REQ-SHIPPING-ADDRESS-DOMAIN Shipping address model

A saved shipping address is one reusable customer-owned delivery destination. Recipient contact information and postal information form a single catalog because they travel together whenever the customer selects that destination.

One customer may keep several addresses and may mark no more than one as the default convenience choice. Checkout can still choose another retained address. At successful purchase, the selected values become an immutable order destination, so later editing, deletion, or account closure cannot rewrite where that order was addressed.

### REQ-SHIPPING-ADDRESS-DOMAIN-1 Define shipping address information

Each shipping address contains:

- recipient name;
- recipient phone number;
- street address;
- city;
- state or province;
- postal code;
- country.

These values describe one reusable destination. An order copies the selected values at purchase rather than relying on a later mutable address.

### REQ-SHIPPING-ADDRESS-DOMAIN-2 Relate addresses to a customer

Each saved address belongs to exactly one customer, and one customer may own multiple addresses. Addresses are not shared across customer ownership boundaries.

Editing one destination does not change another. Customer account deletion removes every address still owned by that customer, without affecting address copies already preserved on orders.

### REQ-SHIPPING-ADDRESS-DOMAIN-3 Designate one default address

A customer address collection may designate zero or one retained address as its default. The designation must point to an address still owned by that customer, and selecting another default transfers the designation.

Default status is a convenience for checkout, not a forced delivery choice. The customer may select another retained address, and a collection with no default remains valid.

### REQ-SHIPPING-ADDRESS-DOMAIN-4 Preserve the purchased shipping destination

Successful order placement copies all recipient and postal values from the selected saved address into the order's shipping destination. The resulting order address cannot be changed.

Later editing or deletion of the saved address, and later customer account deletion, cannot alter or remove this purchase-time destination.

## REQ-SELLER-PROFILE-DOMAIN Seller profile model

A seller profile is the public shop identity associated with one seller account. Customers see it in seller-profile views and through catalog and purchase presentation, while credentials and approval state remain account concerns.

The editable shop name, description, and logo share one profile lifecycle. Each edit leaves immutable evidence, and each order item receives a separate purchase-time view so later profile changes or seller deletion cannot rewrite the seller identity shown in history.

### REQ-SELLER-PROFILE-DOMAIN-1 Define seller profile information

Each seller profile contains:

- `shop name`: the seller identity shown in listings, profiles, and purchase history;
- `shop description`: the shop's customer-facing description;
- `logo image`: the shop's visual identifier.

Seller email, password, approval, suspension, and ban are not profile fields.

### REQ-SELLER-PROFILE-DOMAIN-2 Relate a profile to its seller

Each seller identity owns exactly one seller profile, and a profile belongs to exactly one seller. Profile ownership cannot be shared or transferred.

Authenticated customers may see the public profile. Approval, suspension, ban, and deletion remain states of the owning seller account and do not become profile attributes.

### REQ-SELLER-PROFILE-DOMAIN-3 Preserve seller profile revisions

Every successful change to shop name, description, or logo creates a seller-profile snapshot. The evidence states when the edit occurred, which values changed, and the values before and after the edit.

Later edits cannot alter or delete earlier snapshots. The owning seller and eligible administrators may inspect them under the common snapshot visibility rules.

### REQ-SELLER-PROFILE-DOMAIN-4 Preserve the purchase-time shop identity

Successful payment captures the seller's shop name and logo on each order item. Those values are the seller presentation the customer purchased from.

Later shop-name or logo changes do not rewrite the order item, and seller deletion does not remove the captured shop name. The purchase-time seller profile remains part of preserved order history.

## REQ-SELLER-ACCOUNT-LIFECYCLE Seller account states

Seller registration begins an approval lifecycle before merchandise can be sold. `pending`, `approved`, and `rejected` describe the approval decision; rejection retains its explanation and supports a new pending request.

Suspension, ban, and deletion have different consequences. Suspension is a reversible catalog restriction that leaves existing-order work available. Ban removes authentication while preserving records. Deletion is a seller-initiated terminal state available only after commercial blockers clear, and it removes live listings without erasing purchase evidence.

### REQ-SELLER-ACCOUNT-LIFECYCLE-1 Begin seller approval as pending

Successful seller registration places the account in `pending` approval state. The seller can inspect that status, and an administrator can approve or reject the registration.

Pending remains until a decision. The seller cannot create or edit merchandise or sell products during this state.

### REQ-SELLER-ACCOUNT-LIFECYCLE-2 Operate as an approved seller

Administrator approval changes a pending seller account to `approved`. An approved seller may create and edit owned products, variants, and images, and customers may purchase its visible in-stock variants.

Approval does not neutralize an active ban and does not prevent a later suspension. The seller can inspect the approved result.

### REQ-SELLER-ACCOUNT-LIFECYCLE-3 Recover from seller rejection

Administrator rejection changes a pending account to `rejected` and preserves the administrator's reason for the seller to inspect. A rejected seller cannot sell.

The rejected seller may create a new registration request, which begins separately in `pending`. Reapplication does not rewrite the previous request, its rejection reason, or its final result.

### REQ-SELLER-ACCOUNT-LIFECYCLE-4 Restrict a suspended seller

Administrator suspension places the seller in `suspended` state. Its products become hidden from search and category results and cannot be purchased, and the seller cannot create or edit products, variants, or images.

The seller may still ship existing paid items and decide existing cancellation and refund requests. Orders, history, profile evidence, and purchase snapshots remain.

### REQ-SELLER-ACCOUNT-LIFECYCLE-5 Restore an unsuspended seller

Administrator unsuspension returns a suspended approved account to the ordinary approved, unsuspended state. Live products become visible again subject to their own availability, and the seller regains catalog creation and edit authority.

Unsuspension changes no existing order or request. A separate active ban still prevents authentication.

### REQ-SELLER-ACCOUNT-LIFECYCLE-6 Preserve records for a banned seller

Administrator ban places the seller in `banned` state, refuses login and session continuation, and revokes active sessions. Existing orders, order items, snapshots, and purchase-time seller-profile copies remain.

Ban does not convert order items to a terminal status. Because the seller cannot authenticate, it cannot process those records until the ban is removed.

### REQ-SELLER-ACCOUNT-LIFECYCLE-7 Retire a deleted seller

Eligible seller closure places the account in terminal `deleted` state. Live products leave listings, and their live variant and inventory relationships are removed.

Past orders and snapshots remain, and order items retain the purchase-time shop name and logo. No seller session, login, or later reactivation is available.

## REQ-CATEGORY-DOMAIN Category model

Categories are shared, administrator-curated classifications that customers use to browse merchandise from every seller. Their name and description identify and explain each classification.

The hierarchy has exactly two possible levels: a top-level category or its direct subcategory. Products may choose either level. Category deletion retires only the classification; related products continue as uncategorized merchandise and can later be classified again.

### REQ-CATEGORY-DOMAIN-1 Define category information

Each category contains a `name` that identifies it in browsing and a `description` that explains its scope. Categories are shared across sellers rather than owned by one shop.

Only live categories participate in classification and category browsing.

### REQ-CATEGORY-DOMAIN-2 Limit the category hierarchy

A top-level category has no parent. A subcategory has exactly one top-level parent and cannot itself have children.

Customers can inspect both levels in the complete category list. No deeper nesting belongs to this platform.

### REQ-CATEGORY-DOMAIN-3 Classify a product

A product may relate to one live top-level category or one live subcategory. The classification supports category browsing and does not change the product's seller ownership.

The deletion consequence is defined separately because an affected product remains live even when the selected category is retired.

### REQ-CATEGORY-DOMAIN-4 Uncategorize products after category deletion

When an administrator deletes a category, every related product remains live but loses the category relationship. The product, its variants, images, reviews, and snapshots are not deleted, and the retired category disappears from browsing.

An uncategorized product may later be assigned another live category through product editing.

## REQ-PRODUCT-DOMAIN Product model

A product is merchandise described and owned by the seller that created it. Name, description, category, and base price form the required commercial catalog. Ordered images present it, and variants turn it into concrete option combinations that customers can purchase.

Ownership remains with one seller while the product participates in category browsing, product search, wishlists, ratings, and purchase history. These relationships do not share one lifecycle: live reviews influence the rating, wishlist membership disappears at product deletion, and order-item snapshots survive it.

### REQ-PRODUCT-DOMAIN-1 Define product catalog information

Each live product has:

- a required `name`, used in discovery and purchase history;
- a required `description`;
- a category relationship to a top-level category or subcategory, except when category deletion has made the product uncategorized;
- a required `base price`, used whenever a selected variant has no price override.

### REQ-PRODUCT-DOMAIN-2 Relate a product to its seller

Each product belongs to exactly one seller: the seller that created it. Ordinary catalog changes remain limited to that seller.

Editing the seller profile does not transfer product ownership. Administrator oversight may inspect or remove the product but does not become its owner, and purchase snapshots preserve seller identity separately.

### REQ-PRODUCT-DOMAIN-3 Order product images

A product may contain multiple images in an explicit display order. The first image is the main image used as its thumbnail, while the product detail view presents the complete ordered collection.

Reordering changes the thumbnail. The collection may be empty before upload or after every image is deleted. Both membership and order participate in complete product snapshots.

### REQ-PRODUCT-DOMAIN-4 Relate variants to a product

A product owns zero or more variants, each representing one concrete combination of option values. Variant ownership follows the product's seller.

The product remains visible when it has no variants but is shown as unavailable. Purchase requires at least one live in-stock variant and selection of a specific variant.

### REQ-PRODUCT-DOMAIN-5 Relate products to discovery and history

A product relates to its live category, its non-deleted reviews, customer wishlist entries, and immutable order-item purchase snapshots.

The category supports browsing, live review ratings determine the product average, and wishlist membership points to the product rather than a variant. Purchase snapshots survive later deletion of the live product.

## REQ-PRODUCT-LIFECYCLE Product availability and retirement states

Product visibility and purchasability change independently. A new live product is discoverable even before it has variants, while a zero-variant product is explicitly unavailable. Seller suspension temporarily hides all owned products; unsuspension can restore them.

Deletion is terminal and transitive across the live merchandise aggregate. The listing, images, variants, inventory histories, and wishlist links disappear, while unavailable cart presentation bridges customer correction. Immutable product snapshots and purchase-time order evidence remain.

### REQ-PRODUCT-LIFECYCLE-1 Show a newly created product

After an approved, unsuspended seller creates a product, it appears in applicable search and category results using its current thumbnail, name, price presentation, seller shop name, and live-review rating.

A new product remains visible when it has no variants. Seller suspension or deletion overrides visibility. If category deletion has made it uncategorized, it remains searchable but no longer appears under a category.

### REQ-PRODUCT-LIFECYCLE-2 Mark a product unavailable without variants

When a live product has no variants, it remains visible in product search and its detail information remains readable, but it is marked `unavailable`.

There is no variant to add to a cart or checkout, so every purchase attempt is refused. Adding the first live in-stock variant restores purchase availability.

### REQ-PRODUCT-LIFECYCLE-3 Hide products during seller suspension

When the product's seller is suspended, the product disappears from search and category listings and cannot be purchased. Existing order items and snapshots remain, and the seller cannot edit the hidden product.

Wishlist and cart references remain so customers can see the temporary unavailability; checkout is refused. Unsuspension restores visibility subject to the live product's own variant and stock conditions.

### REQ-PRODUCT-LIFECYCLE-4 Remove live product relationships

Successful product deletion removes the product from the live catalog together with its images, selectable variants, working inventory histories, and every wishlist membership. Cart lines whose variant was deleted remain visible only as unavailable lines until the customer removes or corrects them.

The deleted product has no live detail or review display. Review snapshots, product snapshots, order items, purchase evidence, shipments, and pending cancellation or refund requests are not deleted.

When administrator policy deletion bypasses active obligations, sellers and administrators continue fulfillment and request decisions from order snapshots and a noncatalog variant identity. A later required restoration is retained as obligation evidence; it does not recreate the product, live variant, working stock balance, or purchase availability.

### REQ-PRODUCT-LIFECYCLE-5 Retain history after product deletion

A deleted product cannot appear in search, category browsing, product detail, wishlists, or new purchase selection. Authorized sellers and administrators can still inspect its product snapshots.

Past order items continue to show purchase-time product name, description, variant options, price, and seller presentation without depending on the deleted catalog. Product deletion is terminal; future sales require creation of a new product.

## REQ-PRODUCT-VARIANT-DOMAIN Product variant model

A product variant is one purchasable option combination beneath a product. Its required SKU and option values identify the combination; an optional price can override the parent product's base price. Stock begins at zero and is calculated from inventory history rather than edited as ordinary variant content.

The variant is the quantity-bearing unit used by carts, orders, and inventory. This is different from wishlists, which save products, and from product snapshots, which preserve all contemporaneous variants as one aggregate view.

### REQ-PRODUCT-VARIANT-DOMAIN-1 Define variant information

Each variant contains:

- a required unique `SKU code`;
- `option values` describing the concrete combination, such as color `Red` and size `Large` without requiring every product to use those option names;
- an optional `price override`;
- stock that begins at `0` before inventory movements.

### REQ-PRODUCT-VARIANT-DOMAIN-2 Relate a variant to its product

Each variant belongs to exactly one product and follows that product's seller ownership. It cannot move to another product, and only the owning seller may ordinarily change it.

Deleting the product removes the live variant. Purchase-time variant evidence remains independently available on order items and immutable snapshots.

### REQ-PRODUCT-VARIANT-DOMAIN-3 Resolve the effective variant price

When the variant has a price override, that value is its effective price; otherwise, the parent product's base price applies. An override of zero is present rather than absent.

Listings use effective prices to form ranges, carts and checkout show them, and successful order placement fixes the selected effective price on the order item. Later edits cannot change the purchased price.

### REQ-PRODUCT-VARIANT-DOMAIN-4 Calculate variant stock

Variant stock begins at zero and always equals the sum of the variant's inventory quantity changes. Restock and return movements increase it; purchases and negative seller adjustments decrease it.

Product or variant snapshot edits never change stock. The calculated result determines whether the variant is in stock or out of stock.

### REQ-PRODUCT-VARIANT-DOMAIN-5 Use variants as commerce units

Every cart line, order item, and inventory movement references one specific variant. Repeated quantity for the same variant combines into one cart line before purchase and one order item after purchase, while stock is evaluated for that selected variant.

A wishlist saves the product and does not choose a variant.

## REQ-VARIANT-LIFECYCLE Variant availability and retirement

A live SKU is purchasable only when its calculated stock is positive and the enclosing product and seller are also eligible for sale. Zero stock is a visible, recoverable unavailability state; deletion is a separate terminal change to the live SKU.

Retirement removes working variant and inventory data only after open commerce obligations clear. Purchase-time order evidence and immutable snapshots remain independent of the live record.

### REQ-VARIANT-LIFECYCLE-1 Make an in-stock variant available

A variant is available when its inventory-history sum is greater than zero, its product still exists, and the product has not been hidden from purchase by the seller's approval, suspension, ban, or deletion state.

An available variant may be selected for a new cart line, subject to the requested-quantity stock rule. Its presence also makes the product satisfy the at-least-one-variant side of product purchasability.

### REQ-VARIANT-LIFECYCLE-2 Expose the out-of-stock state

When the inventory sum reaches `0`, the product detail page marks the live variant `out of stock`. A customer cannot add it to a cart. A cart line saved earlier remains visible but is marked unavailable rather than silently removed.

A later positive inventory movement can return the variant to availability if the parent product and seller are still purchasable.

### REQ-VARIANT-LIFECYCLE-3 Retire a deletable variant

The owning seller may delete a variant only when it has no order item in `paid` or `shipped` status and no pending cancellation or refund request. Otherwise, deletion is refused.

Successful deletion removes the live variant and all of its inventory-history records. It cannot be selected or newly added to a cart, and an existing cart reference becomes unavailable. If this was the product's last variant, the product remains discoverable but is shown unavailable.

### REQ-VARIANT-LIFECYCLE-4 Preserve retired-variant evidence

Deleting a variant directly or through product deletion does not rewrite commercial history. Past order details retain the purchase-time product name, SKU evidence, option values, price, and quantity.

Immutable product and variant snapshots that included the SKU remain available to their authorized viewers. The working inventory ledger is removed, but order-item and snapshot evidence is preserved.

If a retained delivered item later receives an approved refund, its positive restoration evidence may refer to the retired variant identity. That historical record neither recreates the live SKU nor contributes a purchasable stock balance.

## REQ-INVENTORY-DOMAIN Inventory history model

Inventory is an append-only ledger for each SKU. Signed movements explain how stock changed and their sum is the only current-stock value, so sellers can reconcile availability from business events rather than an independently editable balance.

Seller-entered movements and automatic commerce movements share the same record meaning while retaining distinct reasons. The owning seller sees the complete sequence; other sellers do not gain visibility into it.

### REQ-INVENTORY-DOMAIN-1 Define an inventory movement

An inventory movement records:

- a signed `quantity change`;
- a `reason` identifying the business cause; and
- the `timestamp` at which it was posted.

Positive quantities represent restocking or stock restored by a cancellation or refund. Negative quantities represent purchases or seller adjustments and losses. These records, rather than snapshots, manage stock.

### REQ-INVENTORY-DOMAIN-2 Attach movements to one variant

Every movement belongs to exactly one live or retired product-variant identity and changes no sibling SKU. The product's owning seller can inspect the working ledger while that variant is live.

Deleting the live variant removes its working inventory records after the variant's deletion blockers have cleared. A later required refund restoration may reference the retired identity as historical obligation evidence, but it creates no current stock and does not restore seller inventory management. Historical order and snapshot evidence is governed separately.

### REQ-INVENTORY-DOMAIN-3 Derive current stock from history

A variant starts at zero stock. Its current stock is always the sum of every retained signed inventory movement for that variant; there is no separately editable balance that can diverge.

Each accepted movement immediately changes the sum. The result drives in-stock and out-of-stock presentation, cart warnings, and checkout eligibility.

### REQ-INVENTORY-DOMAIN-4 Distinguish automatic commerce movements

Successful order placement posts a negative `purchase` movement for each purchased variant and quantity. An approved cancellation posts a positive `cancellation restoration`; an approved refund posts a positive `refund restoration`.

Each automatic record retains its own timestamp and reason, so it remains distinguishable from seller restocks and adjustments and from the other commerce transitions.

### REQ-INVENTORY-DOMAIN-5 Present complete inventory history

The owning seller can view every retained movement for a variant, including its signed quantity, reason, and timestamp. The sequence includes seller restocks and adjustments and automatic purchase, cancellation, and refund records.

The history is presented newest movement first. Pagination uses timestamp followed by a stable record identifier to keep equal-time movements in a deterministic order and to preserve access to older records. Another seller cannot inspect the ledger; authorized administrator oversight remains governed by the platform-wide access boundary.

## REQ-SNAPSHOT-DOMAIN Immutable change snapshots

Snapshots are the platform's durable evidence for mutable commercial information. Each successful covered edit creates a new immutable account of the change; it does not replace earlier evidence. Product snapshots aggregate their child variants and ordered images, while stock remains in its separate inventory ledger.

Evidence remains after the live record is deleted. Visibility follows ownership, purchase involvement, and administrator oversight so snapshots can resolve disputes without becoming public history.

### REQ-SNAPSHOT-DOMAIN-1 Define change snapshots

Whenever editable data in a snapshot-covered concept is successfully modified, the platform creates a snapshot recording when the change occurred, what changed, and the values before and after it. The evidence identifies the changed fields or child content and represents both the previous and resulting state.

Snapshot creation follows the successful modification automatically. A rejected edit produces neither a live change nor a snapshot of a change that did not happen.

### REQ-SNAPSHOT-DOMAIN-2 Keep snapshots immutable

No owner or administrator can edit or delete a snapshot. Later live changes create new snapshots instead of rewriting earlier ones, and deletion of a live record cannot cascade into its evidence.

Authorized visibility grants inspection only. Every attempt to mutate or remove snapshot history is refused.

### REQ-SNAPSHOT-DOMAIN-3 Capture complete product state

A successful edit to a product, its ordered images, or snapshot-covered variant content creates a product snapshot containing:

- product name and description;
- category and base price;
- all images in their current order, including which is first;
- every variant that exists at that moment, each with SKU code, option values, and optional price.

A variant absent at that moment is absent from that snapshot. Stock quantity is not copied into this aggregate because inventory history, rather than snapshots, owns stock changes.

### REQ-SNAPSHOT-DOMAIN-4 Capture other mutable evidence

The other covered concepts retain their concept-specific before-and-after content:

| Concept | Snapshot content |
| --- | --- |
| Seller profile | Shop name, shop description, and logo |
| Review | Rating and text content |
| Cancellation request | Reason and status changes |
| Refund request | Reason and status changes |

Each snapshot is created only after the corresponding modification succeeds.

### REQ-SNAPSHOT-DOMAIN-5 Capture purchase-time item state

Successful payment creates each order item together with immutable purchase-time copies. Product evidence preserves the name and description; variant evidence preserves the selected option values and effective purchase price; seller evidence preserves shop name and logo.

The order item also retains the purchased quantity and seller relationship. Later catalog or profile edits cannot rewrite these commercial facts.

### REQ-SNAPSHOT-DOMAIN-6 Retain evidence after live deletion

Existing snapshots survive deletion of the live concept they describe. Product snapshots survive product or seller deletion; review snapshots survive review or customer deletion; and seller-profile evidence on past order items survives seller deletion.

No supported deletion command removes dispute-resolution history.

### REQ-SNAPSHOT-DOMAIN-7 Limit snapshot visibility

Snapshot history is available only to relevant parties:

- a seller can inspect snapshots of that seller's products and profile;
- a customer can inspect that customer's own review and request history;
- the purchasing customer and item seller can inspect cancellation or refund request history for their order item;
- administrators can inspect product and other snapshots within their oversight authority.

Unrelated customers and sellers cannot view this evidence, and a request from such a party is refused.

## REQ-WISHLIST-DOMAIN Wishlist model

A wishlist is a customer's private set of saved products. It does not choose a SKU, quantity, or price and does not reserve stock, so it remains a lightweight discovery aid rather than a pre-order.

The set has stable paging and follows live product existence. Suspension can make an entry temporarily unavailable, whereas product deletion removes the reference.

### REQ-WISHLIST-DOMAIN-1 Relate a wishlist to its customer and products

Each wishlist belongs to one customer, and every entry references a product rather than a particular variant. Saving requires no options or quantity and grants no stock reservation or purchase right.

Only the owning customer can inspect or change the collection, apart from authorized administrator oversight.

### REQ-WISHLIST-DOMAIN-2 Keep one entry per product

The same live product appears at most once in a customer's wishlist. Saving a product that is already present succeeds without creating a duplicate or changing its original saved time.

Different customers may save the same product independently. Removing an entry changes only the acting customer's relation.

### REQ-WISHLIST-DOMAIN-3 Remove deleted products from wishlists

When a product is deleted by its seller or an administrator, or through seller-account deletion, the platform automatically removes it from every wishlist. Other entries are unaffected and no customer cleanup is needed.

A suspended seller's hidden product has not been deleted. Its wishlist reference remains, but the product cannot be purchased until the seller is unsuspended.

### REQ-WISHLIST-DOMAIN-4 Order wishlist entries for paging

Wishlist entries appear newest saved first. Timestamp followed by a stable entry identifier resolves equal saved times, so paging an unchanged wishlist does not duplicate or skip entries.

## REQ-CART-DOMAIN Shopping cart model

A shopping cart is one customer's private, mutable selection of specific SKUs and quantities. It neither reserves stock nor creates an order. Repeated additions combine by variant, while current catalog values and availability remain visible until checkout fixes purchase facts.

Problems stay inspectable: a line can warn about insufficient stock or become unavailable without disappearing, allowing the customer to correct or remove it.

### REQ-CART-DOMAIN-1 Relate a cart to its customer and variants

Each cart belongs to one customer, and every line references one specific variant with a requested quantity. A product cannot enter the cart without a SKU selection.

The relation creates no stock reservation and no order. Only the owning customer can inspect or change it, apart from authorized administrator oversight.

### REQ-CART-DOMAIN-2 Keep one line per variant

A customer's cart contains at most one line for a variant. Adding the same variant again increases the existing line quantity instead of making a second line.

Different variants of the same product remain separate. Quantity changes affect the combined line, and removal removes the customer's entire requested quantity for that SKU.

### REQ-CART-DOMAIN-3 Present cart-line values

Each line shows the product name, selected variant options, current effective unit price, requested quantity, and subtotal. The subtotal is unit price multiplied by quantity.

A later live price change is reflected when the cart is viewed; successful order placement, not cart entry, fixes the purchase price. An unavailable line retains enough product and variant identification for the customer to understand and remove it.

### REQ-CART-DOMAIN-4 Calculate the cart total

The displayed cart total is the sum of every current line subtotal, including unavailable lines so the full saved cart remains understandable. Removing a line removes its subtotal.

This total is informative. Checkout separately recalculates the payable total from eligible lines and the prices being confirmed.

### REQ-CART-DOMAIN-5 Expose cart availability problems

When a live variant's current stock is less than the requested quantity, the line shows a shortage warning. A deleted or zero-stock variant is marked unavailable. A line is also unavailable when its product is deleted or its seller is suspended, banned, or deleted.

The customer may reduce quantity or remove the line. A line whose quantity cannot be satisfied, or that is otherwise unavailable, cannot be checked out.

## REQ-ORDER-DOMAIN Order model

An order is the durable header for one successful payment. It belongs to the purchasing customer, contains one or more independently progressing order items, and freezes the destination and price facts needed for history even when customer, seller, or catalog records later change.

The item is the junction between a purchased SKU and its seller, snapshots, shipment, cancellation, and refund history. This supports a single checkout spanning sellers without giving one seller authority over another seller's items.

### REQ-ORDER-DOMAIN-1 Define order information

Each order records:

- a system-generated, globally unique and immutable `order number`;
- the `purchase time` at which payment success creates it;
- `total price`, equal to the sum of fixed item unit price multiplied by item quantity; and
- an immutable shipping-address copy containing recipient name, phone, street address, city, state or province, postal code, and country.

The order number and copied destination cannot be changed later.

### REQ-ORDER-DOMAIN-2 Relate an order to its customer and items

Every order belongs to exactly one purchasing customer and contains at least one order item. Items cannot move between orders.

Customer-account deletion removes customer access but preserves the order and its items for seller records and legal history. Administrators retain their oversight visibility.

### REQ-ORDER-DOMAIN-3 Combine purchased quantity by variant

Within one order, all quantity purchased for the same variant becomes one order item. Buying three units therefore produces one item with quantity `3`, not three items.

Different variants produce different items. Each item retains a fixed per-unit purchase price, and its subtotal is that price multiplied by quantity.

### REQ-ORDER-DOMAIN-4 Allow multi-seller orders

One customer order may contain items from multiple sellers. Each item retains its own seller and purchase-time shop snapshot, and only that seller can ordinarily inspect and process it.

Different sellers fulfill through separate shipments. Cancellation and refund decisions also remain specific to the seller of the targeted item.

### REQ-ORDER-DOMAIN-5 Relate items to fulfillment and after-sales records

Each item retains its product, selected-variant, and seller-profile purchase snapshots in every status. A shipped item belongs to one shipment and shares its tracking; a paid item may receive a cancellation request; and a delivered item may receive a refund request.

Each request targets one item. Its processing does not stop unrelated items in the same order from continuing through their own fulfillment and after-sales paths.

## REQ-ORDER-ITEM-LIFECYCLE Order item states

Every order item starts in `paid` after payment succeeds, then progresses independently through fulfillment or an allowed after-sales resolution. Shipment and delivery are package-driven; cancellation and refund are item-driven. Final transitions restore money and stock without rewriting purchase evidence.

Administrator force actions use explicit state boundaries so oversight cannot relabel an already final item or use cancellation in place of a delivered-item refund.

### REQ-ORDER-ITEM-LIFECYCLE-1 Begin items in paid status

Successful payment creates each purchased variant as one order item in `paid` status, awaiting its seller's shipment. Its quantity, fixed price, and product, variant, and seller-profile snapshots are captured, and a negative purchase inventory movement is posted.

A paid item is eligible for seller shipment and for a customer cancellation request. Payment failure creates no order or paid item.

### REQ-ORDER-ITEM-LIFECYCLE-2 Transition paid items to shipped

When the owning seller creates a shipment from one or more of that seller's `paid` items, every selected item changes to `shipped` and shares the shipment's carrier and tracking number. The shipment records its shipping time.

Unselected items keep their statuses. An item not in `paid` status, owned by another seller, or already assigned to a shipment cannot be included, and a shipped item no longer accepts an ordinary cancellation request.

### REQ-ORDER-ITEM-LIFECYCLE-3 Transition shipped items to delivered

All `shipped` items in a shipment change to `delivered` when the purchasing customer confirms that shipment or, without confirmation, fourteen days after its shipping time. Confirmation is per shipment, not per item.

The delivery time is the confirmation time or the automatic transition time. Customer confirmation is refused for another customer's shipment or one not currently shipped. Delivery begins each item's seven-day refund-request window.

### REQ-ORDER-ITEM-LIFECYCLE-4 Transition an item to cancelled

Seller approval of a pending cancellation changes its `paid` item to `cancelled`. An administrator may force-cancel an item in `paid` or `shipped`, but not one already `delivered`, `cancelled`, or `refunded`.

Cancellation refunds that item and posts a positive cancellation-restoration movement for its quantity. Other items are unchanged. If a shipped item is force-cancelled, its shipment and tracking remain historical evidence.

### REQ-ORDER-ITEM-LIFECYCLE-5 Transition an item to refunded

Seller approval of a pending refund changes its `delivered` item to `refunded`. An administrator may force-refund an item in `paid`, `shipped`, or `delivered`, but not one already `cancelled` or `refunded`.

Refunding returns that item's payment and posts a positive refund-restoration movement for its quantity. Other items remain unchanged, and any shipment or delivery evidence remains linked as history.

### REQ-ORDER-ITEM-LIFECYCLE-6 Preserve item facts across status changes

Items in `paid`, `shipped`, `delivered`, `cancelled`, and `refunded` retain the same purchased quantity, fixed unit price, and product, variant, and seller-profile snapshots.

Stock restoration does not change the item quantity or price. Live catalog and shop changes cannot rewrite the item, and shipment or request history remains linked after a final status.

## REQ-ORDER-LIFECYCLE Derived order states

An order has no independently edited status. Its current status is recalculated from all item statuses after each item transition. Homogeneous orders receive their matching state, the in-transit predicate covers shipments before any delivery, and every other mixture is `partially completed`.

This derivation reports progress without coupling the items: one item may still ship or complete an after-sales path while the order header reflects the aggregate.

### REQ-ORDER-LIFECYCLE-1 Derive paid order status

The order is `paid` when every one of its items is `paid`. Because an order has at least one item, this means no item has yet become shipped, delivered, cancelled, or refunded.

Any item leaving `paid` causes immediate recalculation.

### REQ-ORDER-LIFECYCLE-2 Derive shipped order status

The order is `shipped` when at least one item is `shipped` and no item is `delivered`. Other items may still be paid, cancelled, or refunded.

The first delivery prevents this predicate from applying, even if another item remains in transit.

### REQ-ORDER-LIFECYCLE-3 Derive delivered order status

The order is `delivered` only when every item is `delivered`. A paid, shipped, cancelled, or refunded item prevents this all-delivered result.

Shipments may reach delivery at different times; the final qualifying delivery changes the derived status.

### REQ-ORDER-LIFECYCLE-4 Derive cancelled order status

The order is `cancelled` only when every item is `cancelled`, whether through individual approvals or administrator force actions. Any different item state prevents the all-cancelled result.

Cancellation never deletes the order or its evidence.

### REQ-ORDER-LIFECYCLE-5 Derive refunded order status

The order is `refunded` only when every item is `refunded`, whether through request approvals or administrator force actions. Any different item state prevents the all-refunded result.

Refunding never removes purchase, shipment, or request history.

### REQ-ORDER-LIFECYCLE-6 Derive partially completed status

The order is `partially completed` for every mixed combination that does not satisfy the five preceding formulas. Examples include:

- delivered together with any different state;
- shipped together with delivered;
- cancelled together with refunded; and
- any other mixture not covered by the shipped predicate.

This aggregate state does not block an item from continuing through an otherwise eligible transition.

## REQ-SHIPMENT-DOMAIN Shipment model

A shipment is one physical package dispatched by one seller. It owns a nonempty selection of that seller's paid order items, and its tracking and delivery facts apply to every included item. The seller may choose one-item packages or bundles while seller boundaries remain absolute.

Shipping time anchors automatic delivery. The package remains historical evidence even if an included item later reaches an after-sales final state.

### REQ-SHIPMENT-DOMAIN-1 Define shipment information

Each shipment records the seller-entered carrier name and tracking number and the time at which shipment creation succeeds. The carrier-and-number pair is the tracking identity because different carriers may use overlapping number spaces.

The shipping time begins the fourteen-day period for automatic delivery.

### REQ-SHIPMENT-DOMAIN-2 Relate a shipment to its seller and items

Every shipment belongs to one seller and contains one or more of that seller's `paid` order items. Each selected item must belong to the relevant customer order and can appear in at most one shipment.

The purchasing customer can inspect the package and included items through order details.

### REQ-SHIPMENT-DOMAIN-3 Permit split and bundled fulfillment

A seller may ship one eligible item alone or bundle multiple eligible items, even when they represent different products or variants. The seller may create separate packages for other items.

An item is selected as a whole and cannot be split across shipments. Paid items not selected remain eligible for a later shipment.

### REQ-SHIPMENT-DOMAIN-4 Separate shipments by seller

All items in a shipment must belong to the same seller. Items from different sellers in one customer order require different packages, and one seller cannot ship another's item.

If any selected item belongs to another seller, shipment creation is refused, no shipment is stored, and no selected item changes status.

### REQ-SHIPMENT-DOMAIN-5 Share tracking and delivery by package

Every item in one shipment shares its carrier, tracking number, shipping time, and shipment-wide delivery transition. Order details identify the package's included items.

Customer confirmation delivers all its currently shipped items, and the fourteen-day timeout applies to the same set. A later cancellation or refund does not erase the shipment or tracking history.

## REQ-CANCELLATION-DOMAIN Cancellation request lifecycle

A cancellation request is one customer's reasoned request to stop one `paid` item before shipment. It is decided only by that item's seller, and approval affects money, stock, and item status for the target alone.

Each submission and response remains attributable to its customer, seller, order, and item. A decision closes the request and produces immutable evidence.

### REQ-CANCELLATION-DOMAIN-1 Open a cancellation request

The purchasing customer may submit a text reason for one item currently in `paid` status. The platform creates a `pending` cancellation request with its creation time and target item; no other order item is included.

Only one cancellation request may be pending for an item. A duplicate pending request is refused. After a rejection closes the earlier request, the customer may submit a new one if the item is still paid. A non-purchaser or a request for a non-paid item is refused.

### REQ-CANCELLATION-DOMAIN-2 Approve a cancellation request

The target item's seller may approve its `pending` request only while the item remains `paid`. The request becomes `approved`, the item becomes `cancelled`, and a decision snapshot records the transition.

The customer is refunded for that item, and a positive cancellation-restoration movement returns its quantity to stock. Other items continue unchanged. A different seller, non-pending request, or no-longer-paid item is refused.

### REQ-CANCELLATION-DOMAIN-3 Reject a cancellation request

The target item's seller may reject its `pending` request only while the item remains `paid`. The request becomes `rejected`, the item stays paid, and the customer can see the outcome.

A decision snapshot records the transition. No refund or inventory movement occurs, and the seller may still ship the item. A different seller, non-pending request, or no-longer-paid item is refused.

### REQ-CANCELLATION-DOMAIN-4 Preserve cancellation decision history

Every successful seller response creates an immutable snapshot with the request reason, response time, `pending` before-state, and `approved` or `rejected` after-state.

Later item, customer, seller, or account changes cannot delete it. The linked customer and seller and authorized administrators may inspect it.

### REQ-CANCELLATION-DOMAIN-5 Relate cancellation participants and target

Each request remains linked to its purchasing customer, target order and item, and that item's seller. Only the linked customer creates it, and only the linked seller ordinarily decides it.

Administrators may inspect the history and use force-cancellation authority without creating a false seller decision. Participant links and the captured reason survive later customer or seller deletion.

## REQ-REFUND-DOMAIN Refund request lifecycle

A refund request is one customer's reasoned request about one recently delivered item. The recorded delivery time starts a strict seven-day submission window, and only the target item's seller ordinarily decides the request.

Approval changes money, stock, and only that item's status. Either decision closes the request and leaves immutable evidence tied to the purchase and participants.

### REQ-REFUND-DOMAIN-1 Open a refund request

Within seven days of an item's recorded delivery time, the purchasing customer may submit a text reason. The platform creates a `pending` refund request with its creation time and that one delivered item as target.

Only one refund request may be pending for an item. A duplicate pending request is refused. After a rejection, the customer may submit another request only if the same seven-day deadline has not passed and the item is still delivered. A non-purchaser, non-delivered item, or late request is refused.

### REQ-REFUND-DOMAIN-2 Approve a refund request

The target item's seller may approve its `pending` request only while the item remains `delivered`. The request becomes `approved`, the item becomes `refunded`, and a decision snapshot records the transition.

The customer is refunded for that item and a positive refund-restoration movement returns its quantity to stock. Other items remain unaffected. A different seller, non-pending request, or no-longer-delivered item is refused.

### REQ-REFUND-DOMAIN-3 Reject a refund request

The target item's seller may reject its `pending` request only while the item remains `delivered`. The request becomes `rejected`, the item stays delivered, and the customer can see the result.

A snapshot records the transition. No refund or inventory movement occurs, and shipment and delivery evidence remain unchanged. A different seller, non-pending request, or no-longer-delivered item is refused.

### REQ-REFUND-DOMAIN-4 Preserve refund decision history

Every successful seller response creates an immutable snapshot with the request reason, response time, `pending` before-state, and `approved` or `rejected` after-state.

Later item, customer, seller, or account changes cannot delete it. The linked customer and seller and authorized administrators may inspect it.

### REQ-REFUND-DOMAIN-5 Relate refund participants and target

Each request remains linked to its purchasing customer, target order and item, and that item's seller. Only the linked customer creates it, and only the linked seller ordinarily decides it.

Administrators may inspect the history and use force-refund authority without creating a false seller decision. Participant links and the captured reason survive later customer or seller deletion.

## REQ-REVIEW-DOMAIN Review model

A review is verified product feedback from the customer who bought and received the product. Its product-level identity allows one review per product per order even when quantity or variants differ, while a later order creates a new opportunity.

The live review affects product presentation and ratings. Review deletion retires that effect but not the identity or audit evidence; customer deletion instead preserves the live review under anonymous attribution.

### REQ-REVIEW-DOMAIN-1 Define review information

Each review records a required integer rating of `1`, `2`, `3`, `4`, or `5`, optional text content, and its publication time. Text may be absent without preventing publication.

Publication time supports newest-first display. The live review carries its latest rating and text, while earlier edits remain in snapshots.

### REQ-REVIEW-DOMAIN-2 Relate a review to its purchase

Every review links one customer author, one product, and one qualifying order belonging to that customer. At least one item for the product in that order must have reached `delivered`. The relation remains product-level even though purchase happened through a variant.

Product deletion hides the review with the retired product, but the review record and snapshots remain available as dispute evidence to the author and authorized administrators.

### REQ-REVIEW-DOMAIN-3 Limit reviews per purchase

At most one review identity exists for a customer, product, and order combination. Multiple quantities or variants of that product in the same order do not create extra review opportunities; a later separate order does.

Deleting the review does not reset the limit. The author may edit before deletion but cannot recreate another review for the same customer-product-order combination afterward.

### REQ-REVIEW-DOMAIN-4 Retire a review from ratings

Author deletion removes the live review from product detail and excludes its rating from both the average's numerator and non-deleted review count. Its text is no longer public.

Immutable edit snapshots remain available to authorized parties, and the retired review identity continues to enforce the one-review limit.

### REQ-REVIEW-DOMAIN-5 Anonymize reviews after customer deletion

When an author deletes the customer account, the live review keeps its rating and text but displays the author as `deleted user` with no profile link. Because the review itself remains non-deleted, its rating still contributes to the product average.

Edit snapshots remain retained, and the deleted customer cannot regain authorship access.

## REQ-REVIEW-LIFECYCLE Review publication and retirement

Review publication is available only after verified delivery. The live rating and optional text can be revised by their author with immutable history, or retired by that author. Account closure takes a different path: it anonymizes rather than removes live feedback.

Product display and aggregate rating always follow current, non-deleted live reviews, while snapshots preserve earlier states.

### REQ-REVIEW-LIFECYCLE-1 Publish an eligible review

The purchasing customer may publish a required rating from `1` through `5` and optional text for a product in a qualifying delivered order. The review appears on product detail in newest-first order, its rating enters the non-deleted average, and it increases the non-deleted review count.

Publication is refused without a delivered qualifying item, for an invalid rating, or when the customer-product-order review identity already exists.

### REQ-REVIEW-LIFECYCLE-2 Edit a published review

The author may replace the rating or text of a live review. The rating remains required and within `1` through `5`; text may be added, changed, or cleared. The live review adopts the new values, the product average recalculates, and an immutable snapshot stores the before-and-after state.

Editing retains the original publication time used for newest-first order. Another customer, an invalid rating, or a deleted review is refused.

### REQ-REVIEW-LIFECYCLE-3 Delete a published review

The author may permanently retire a live review. It disappears from product detail, and its rating leaves both the average and non-deleted review count immediately.

Immutable snapshots are not deleted. The retired identity cannot be edited or recreated for the same customer-product-order tuple. Another customer or an already deleted review cannot perform the deletion.

### REQ-REVIEW-LIFECYCLE-4 Anonymize reviews on account closure

When a customer deletes the account, every live review by that customer remains published with unchanged rating and optional text under `deleted user` attribution. It remains in the product's average and review count, while its profile link disappears.

Snapshots remain immutable. Because the account and sessions are gone, no later edit or deletion can be authenticated as that customer.

## REQ-ADMIN-REQUEST-DOMAIN Administrator request lifecycle

An administrator request lets an existing customer or seller apply for the regular administrator grade with a reason. Super administrators alone decide it. Approval adds authority to the existing identity; rejection preserves ordinary identity and permits a later fresh application.

Applications remain an attributable governance history. A final request is never reopened or overwritten.

### REQ-ADMIN-REQUEST-DOMAIN-1 Open an administrator request

A customer or seller who holds no administrator grade may submit a text reason. The platform creates a `pending` request linked to that applicant and records its creation time.

Only one request may be pending for an applicant. Another submission during that state is refused. A rejected applicant may apply again later, but a regular or super administrator cannot create another application.

### REQ-ADMIN-REQUEST-DOMAIN-2 Approve an administrator request

A super administrator may approve a `pending` request. It becomes `approved`, records the deciding super administrator and decision time, and grants `regularAdministrator` to the applicant's existing customer or seller identity immediately.

Credentials and underlying identity remain unchanged. Approval does not grant `superAdministrator`. A non-super actor or non-pending request is refused.

### REQ-ADMIN-REQUEST-DOMAIN-3 Reject an administrator request

A super administrator may reject a `pending` request. It becomes `rejected`, records the deciding super administrator and decision time, and grants no administrator authority.

The applicant remains the same customer or seller and can view the result. A later application is a new request. A non-super actor or non-pending request is refused.

### REQ-ADMIN-REQUEST-DOMAIN-4 Retain administrator request history

Every request retains its applicant identity, applicant reason, status, and creation time. An approved or rejected request also retains its decision time and deciding super administrator; those decision fields are absent while pending.

A later application does not overwrite an earlier rejection. Super administrators can view pending requests, and retained decisions remain available to authorized administrators as governance history.

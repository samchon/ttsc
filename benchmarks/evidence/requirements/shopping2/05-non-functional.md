# Product-visible quality and continuity requirements

This document states the reliability, integrity, continuity, and privacy outcomes that customers, sellers, and administrators can rely on. It does not redefine the operations and business rules that produce those outcomes.

## REQ-NFR-AUDIT-INTEGRITY Commercial change evidence integrity

Commercial evidence remains understandable and trustworthy across edits, disputes, and live-record retirement. Owners see evidence for subjects they own, and administrators use platform-wide oversight; unrelated actors do not gain history access.

Snapshots preserve immutable before-and-after states. Product evidence represents the complete merchandise aggregate at one time, while stock and purchase evidence use their own durable movement and order forms.

### REQ-NFR-AUDIT-INTEGRITY-1 Keep commercial change evidence immutable

Every snapshot created for a product, variant, seller profile, order item, review, cancellation request, or refund request remains immutable after creation and stays available to its authorized relevant parties after later edits or live deletion. The evidence has no edit or delete capability.

An owner with a usable identity may inspect evidence for their own retained subject. Regular and super administrators retain dispute-oversight access. An unrelated customer or seller, unauthorized actor, or attempt to alter or delete evidence is refused.

### REQ-NFR-AUDIT-INTEGRITY-2 Reconstruct each recorded modification

Each editable-data snapshot identifies when the modification occurred, what fields or collection members changed, and their complete before-and-after values. Unchanged aggregate context needed to understand the time point remains present.

Decision snapshots show prior and resulting request status. Review evidence shows prior and resulting rating and text. Seller-profile evidence shows prior and resulting shop name, description, and logo.

### REQ-NFR-AUDIT-INTEGRITY-3 Preserve a complete product time point

Every product or variant edit captures product name, description, category, base price, ordered images, and every contemporaneous variant's SKU code, option values, and optional price override. Image order identifies the thumbnail, and variants untouched by that particular edit remain represented.

Later product or variant deletion does not remove the snapshot. Inventory quantity remains traceable through movement history rather than being mistaken for a variant snapshot field.

### REQ-NFR-AUDIT-INTEGRITY-4 Trace stock and purchase evidence end to end

Each retained inventory movement exposes signed quantity, reason, and time. Current live stock reconciles to the sum of the variant's complete working history, and automatic purchase, cancellation, refund, and force-action movements identify their order item or resolution cause.

Every purchased line retains product, variant, seller, unit price, quantity, shipping address, payment, and later resolution evidence. When live SKU retirement removes working inventory, order and snapshot evidence still explains purchased and later restored quantities under the retired SKU identity. Account or catalog deletion does not erase purchase-time evidence.

Only the relevant customer, item seller, or administrator may inspect the corresponding commercial history.

## REQ-NFR-PURCHASE-CONSISTENCY Purchase and resolution consistency

Customers can rely on money, merchandise, stock, carts, and order evidence agreeing at every terminal purchase or resolution outcome. A successful payment appears once as a complete purchase; a confirmed failure leaves a clean retry state.

Later cancellation and refund outcomes keep money, status, evidence, and stock synchronized without disturbing unrelated lines in a mixed-seller order.

### REQ-NFR-PURCHASE-CONSISTENCY-1 Expose one complete successful purchase outcome

For each confirmed payment attempt, the customer sees exactly one corresponding order whose `paid` items, purchase evidence, exact stock decreases, and purchased-cart removal become visible together. A successful charge is never left without its order outcome.

The order total equals the confirmed charge and captured item prices. Each purchased quantity agrees across its item, negative inventory movement, and removed cart line. Repeated gateway notification duplicates neither the order nor any effect; a mismatch remains in payment reconciliation until a consistent outcome is available.

### REQ-NFR-PURCHASE-CONSISTENCY-2 Preserve a clean state after payment failure

After a confirmed payment failure, the customer sees no order, item, purchase snapshot, inventory movement, or cart removal from that attempt. Every selected line remains in the cart at its saved quantity, and released stock holds no longer reduce available-to-purchase stock.

A fresh attempt begins from current revalidated facts. An unknown result remains visibly unresolved through reconciliation and is not presented as a confirmed failure.

### REQ-NFR-PURCHASE-CONSISTENCY-3 Keep each commercial reversal synchronized

An approved cancellation, approved refund, or administrator force resolution changes the target terminal status, customer funds, exact stock-restoration evidence, request or forced-action evidence, and derived order status as one visible outcome and at most once.

Cancellation produces `cancelled`; refund produces `refunded` according to the owning action. The refunded amount is the line amount and the restored quantity is the purchased quantity. A replay cannot pay or restore the line again. If a required effect fails, the prior commercial state remains visible until resolution succeeds.

### REQ-NFR-PURCHASE-CONSISTENCY-4 Preserve independent item progress

When one item or shipment changes, every unrelated order item retains its own status, seller, shipment, request, snapshot, unit price, quantity, and inventory evidence. One cancellation or refund does not stop another seller's fulfillment, and one shipment or delivery changes no item outside that shipment.

Overall order status changes only through its documented derivation from all resulting item states. A whole-order force action changes only its complete eligible set and reports every other line unchanged.

## REQ-NFR-HISTORY-CONTINUITY Commercial history and privacy continuity

Commercial history stays intelligible when accounts, catalog records, addresses, profiles, and reviews change or retire. Past orders present what was purchased and confirmed at that time, while fulfillment facts continue to reflect current progress.

Retention does not make history public. Customers, item sellers, review authors, and administrators receive only the history their ownership or platform authority makes relevant, and customer closure removes live personal identity from future presentation.

### REQ-NFR-HISTORY-CONTINUITY-1 Keep commercial history through retirement

Retained orders and immutable snapshots remain usable after related customer or seller closure and after product, variant, seller-profile source, or review retirement.

Customer closure does not remove seller or administrator access to order evidence. Seller closure does not remove customer or administrator access to purchase evidence. Product or variant deletion does not remove order-item or product snapshots. Review deletion removes public feedback but not its immutable edit evidence.

### REQ-NFR-HISTORY-CONTINUITY-2 Keep past-order presentation stable

Past orders continue to show purchase-time product name and description, variant options and unit price, seller shop name and logo, quantity, total, and the complete confirmed shipping address. Later live edits or deletion do not rewrite those values.

The address retains recipient name, phone number, street address, city, state or province, postal code, and country. Current item status, shipment membership, carrier, tracking number, and shipping or delivery time remain live fulfillment facts. Deleted live subjects are represented by retained identifiers or purchase snapshots.

### REQ-NFR-HISTORY-CONTINUITY-3 Remove former-customer identity from live presentation

After customer account deletion, the former display name, phone number, credentials, saved addresses, and profile link are no longer available. Retained public reviews keep their rating and optional text but identify the author only as `deleted user`.

Orders retain their immutable destination as purchase evidence without restoring a customer profile. A new registration using the former email receives no attribution to retained orders or reviews, and the deleted customer has no authenticated history access.

### REQ-NFR-HISTORY-CONTINUITY-4 Limit retained history to relevant parties

The purchasing customer may inspect their retained orders. Each seller may inspect only their attributed items and owned evidence, including fulfillment and request records needed for existing-order duties. A review author with a usable identity may inspect their own review evidence.

Current regular and super administrators may inspect platform records under oversight authority; super-only governance data keeps its separate higher-grade rule. An unauthenticated, deleted, banned, unrelated, or insufficiently graded actor is refused, and no account-state change broadens access for anyone else.

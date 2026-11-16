# Security Specification — Yi Lai Hub

## 1. Data Invariants
1. **Strict Ownership**: Every document in `users`, `products`, `clients`, `orders`, and `orders/{orderId}/items` belongs to a single verified Firebase Auth user (`ownerId == request.auth.uid`, or `userId == request.auth.uid` for `users`).
2. **PII Isolation**: Client WhatsApp numbers, emails, and user profiles are readable and writable ONLY by the owning authenticated and email-verified user. No blanket `isSignedIn()` reads or list queries are permitted.
3. **Referential Integrity**:
   - An `order` cannot be created unless `clientId` points to an existing `/clients/{clientId}` document owned by `request.auth.uid`.
   - An `orderItem` cannot be created unless its parent `/orders/{orderId}` exists after the batch (`getAfter(...)`) and is owned by `request.auth.uid`, AND `productId` points to an existing `/products/{productId}` owned by `request.auth.uid`.
4. **Immutable Fields**: `id`, `ownerId`, and `createdAt` cannot be modified after creation. `orderId` and `clientId` on orders cannot be reassigned after creation.
5. **Temporal Integrity**: `createdAt` must equal `request.time` on create; `updatedAt` must equal `request.time` on create and update.
6. **Terminal State Locking**: Once an order reaches `completed` or `cancelled`, its `status` cannot be changed to another value.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Product Read**: Anonymous/unauthenticated `get` on `/products/prod_1` -> Denied.
2. **Cross-Tenant Client List**: Signed-in User B listing `/clients` without `where('ownerId', '==', uid_B)` or trying to read User A's client -> Denied.
3. **Identity Spoofing on Product Create**: User A creating `/products/prod_2` with `ownerId: "user_B"` -> Denied.
4. **Shadow Field Injection on Client**: User A creating `/clients/cli_1` with extra ghost field `isAdmin: true` -> Denied by `keys().hasOnly(...)`.
5. **Resource Exhaustion / ID Poisoning**: User A creating `/products/<200-char-invalid-id!@#>` -> Denied by `isValidId()`.
6. **Oversized String Attack**: User A creating `/products/prod_3` with `notes` > 1000 chars -> Denied by `.size() <= 1000`.
7. **Negative Factory Price**: User A creating `/products/prod_4` with `factoryPrice: -5` -> Denied by `factoryPrice >= 0`.
8. **Orphan Order Creation**: User A creating `/orders/ord_1` referencing nonexistent `clientId: "missing_client"` -> Denied by `exists()`.
9. **Cross-Tenant Client Reference on Order**: User A creating `/orders/ord_2` referencing User B's `clientId` -> Denied by `get(...).data.ownerId == request.auth.uid`.
10. **Client-Forged Timestamp**: User A creating `/products/prod_5` with backdated `createdAt` != `request.time` -> Denied.
11. **Immutable Owner Mutation on Update**: User A updating `/orders/ord_1` to change `ownerId` or `createdAt` -> Denied.
12. **Terminal State Reversal**: User A updating `/orders/ord_completed` from `status: "completed"` back to `status: "quoted"` -> Denied by terminal state lock.

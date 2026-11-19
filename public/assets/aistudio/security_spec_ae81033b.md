# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **User Profile (`/users/{userId}`)**: Only the verified Google account whose `request.auth.uid == userId` and `email_verified == true` may read, create, or update their own profile. Blanket `list` is denied. `ownerUid` and `createdAt` are immutable.
2. **Inventory Products (`/users/{userId}/productos/{productId}`)**: Every product belongs strictly to an existing `/users/{userId}` parent document. Only `ownerUid == request.auth.uid` can read, list (via `where('ownerUid', '==', uid)`), create, update, or delete. `costo`, `precio`, `stock` must be non-negative numbers.
3. **Repair Orders (`/users/{userId}/reparaciones/{repairId}`)**: Every repair order belongs to `/users/{userId}` and requires `estado` to be one of `'En Reparación' | 'Listo para Entregar' | 'Retirado'` and non-negative numeric amounts.
4. **Sale Records (`/users/{userId}/historial/{saleId}`)**: Every sale belongs to `/users/{userId}`. Optional `items` list is bounded to `<= 100` entries of map type. All string fields enforce explicit `.size()` limits.

## 2. The "Dirty Dozen" Payloads (Expected: `PERMISSION_DENIED`)
1. Unauthenticated `get` / `list` / `create` on `/users/uid1/productos/p1`.
2. Verified user `uid2` attempting `get` or `list` on `/users/uid1/productos`.
3. `create` product with `ownerUid: "uid2"` while signed in as `uid1` (Identity Spoofing).
4. `create` product with extra ghost field `isAdmin: true` (Shadow Field Attack).
5. `update` product changing `ownerUid` or `createdAt` (Immortal Field Tampering).
6. `create` product with `nombre` exceeding 160 characters or empty `codigo` (Resource Poisoning).
7. `create` product with negative `stock: -5` or negative `precio: -100`.
8. `create` repair order under `/users/uid1/reparaciones/r1` when `/users/uid1` parent profile does not exist (Orphaned Record).
9. `create` repair order with invalid `estado: "Gratis"`.
10. `create` sale record with client-forged past `createdAt` timestamp instead of `request.time`.
11. `create` sale record with `items` containing `> 100` elements or `items[0]` as a raw string instead of map.
12. `get` or `list` on `/users` collection to scrape user emails (PII Blanket Read).

# InvenTree Parts API — Manual Test Cases

**Source of truth:** [`agents/context/api-schema-summary.md`](../agents/context/api-schema-summary.md)
(ingested from `docs.inventree.org/en/stable/api/schema/part/`).

**Legend** — Priority: P1/P2/P3. Type: Positive/Negative/Boundary.
Auth default: Token auth via `Authorization: Token <key>` unless a case specifies otherwise.

---

## 1. Parts — CRUD

| ID | Title | Request | Preconditions | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| API-P-01 | Create part with required fields | `POST /api/part/` body `{"name": "Resistor 10k"}` | Authenticated, add-permission | `201 Created`; response body includes `pk`, `name="Resistor 10k"`, defaults applied (`active=true`, `units=""` or `"pcs"` per instance default). | P1 | Positive |
| API-P-02 | Create part with full field set | `POST /api/part/` full payload (name, IPN, description, category, units, assembly, component, etc.) | Category id known | `201 Created`; every submitted field echoed back unchanged in the response. | P1 | Positive |
| API-P-03 | Retrieve a part by id | `GET /api/part/{id}/` | Part exists | `200 OK`; body matches the part's current field values, including computed fields (`in_stock`, `full_name`). | P1 | Positive |
| API-P-04 | List parts | `GET /api/part/` | 3+ parts exist | `200 OK`; paginated envelope `{count, next, previous, results}`; `results` length ≤ default page size. | P1 | Positive |
| API-P-05 | Partial update via PATCH | `PATCH /api/part/{id}/` body `{"description": "Updated"}` | Part exists | `200 OK`; only `description` changed; all other fields unchanged from before the call. | P1 | Positive |
| API-P-06 | Full update via PUT | `PUT /api/part/{id}/` full payload with one field changed | Part exists | `200 OK`; fields present in payload are set exactly as given. | P2 | Positive |
| API-P-07 | Delete a part with no references | `DELETE /api/part/{id}/` | Part has no stock/BOM/order references | `204 No Content`; subsequent `GET /api/part/{id}/` returns `404`. | P1 | Positive |
| API-P-08 | Retrieve non-existent part | `GET /api/part/999999999/` | id does not exist | `404 Not Found`. | P1 | Negative |
| API-P-09 | Update non-existent part | `PATCH /api/part/999999999/` | id does not exist | `404 Not Found`. | P2 | Negative |
| API-P-10 | Delete requires deactivation first; stock alone doesn't block it | `PATCH {active:false}` then `DELETE /api/part/{id}/` | Part has 1+ associated stock items | Deleting an **active** part is rejected (`400`, "Cannot delete this part as it is still active") regardless of references — verified against a live instance. Once deactivated, a part with only stock references (no BOM reference) deletes successfully (`204`) — stock alone does **not** block deletion; contrast with API-R-06/07 where a BOM reference **does** still block deletion after deactivation. | P1 | Negative→Positive (corrected) |

## 2. Part Categories — CRUD

| ID | Title | Request | Preconditions | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| API-C-01 | Create top-level category | `POST /api/part/category/` body `{"name": "Mechanical"}` | — | `201 Created`; `parent` is `null`. | P1 | Positive |
| API-C-02 | Create nested category | `POST /api/part/category/` body `{"name": "Fasteners", "parent": <id>}` | Parent category exists | `201 Created`; `parent` matches supplied id; `pathstring` reflects nesting. | P1 | Positive |
| API-C-03 | Retrieve category tree | `GET /api/part/category/tree/` | Multi-level tree exists | `200 OK`; response reflects correct parent/child nesting and ordering. | P2 | Positive |
| API-C-04 | Update category | `PATCH /api/part/category/{id}/` body `{"description": "Updated"}` | Category exists | `200 OK`; field updated, others unchanged. | P2 | Positive |
| API-C-05 | Delete empty category | `DELETE /api/part/category/{id}/` body `{"delete_child_categories": false, "delete_parts": false}` | Category has no parts/children | `204 No Content`. **Body is required** — verified against a live instance a bodyless DELETE returns `400` ("This field is required") and deletes nothing; this isn't documented on the static schema page. | P1 | Positive |
| API-C-06 | Delete category containing parts reassigns them, doesn't delete them | `DELETE /api/part/category/{id}/` body `{"delete_child_categories": false, "delete_parts": false}` | Category has 1+ parts assigned | `204 No Content`; contained parts are reassigned to the deleted category's parent (or root) — confirmed against a live instance — not deleted. Re-fetching a contained part shows `category` changed away from the deleted id. | P1 | Positive (corrected from Negative) |
| API-C-07 | Category cycle rejected | `PATCH /api/part/category/{parentId}/` body `{"parent": <childId>}` where childId is a descendant of parentId | Parent/child relationship exists | `400 Bad Request`; error names the circular-reference violation. | P2 | Negative |
| API-C-08 | Category self-parent rejected | `PATCH /api/part/category/{id}/` body `{"parent": <id>}` (itself) | Category exists | `400 Bad Request`. | P2 | Negative |

## 3. Filtering, Pagination & Search — `GET /api/part/`

| ID | Title | Request | Preconditions | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| API-F-01 | Search by keyword | `GET /api/part/?search=resistor` | Parts with "resistor" in name/description exist | `200 OK`; all returned `results` match the search term in name/description/IPN/keywords. | P1 | Positive |
| API-F-02 | Filter by exact IPN | `GET /api/part/?IPN=R-1000` | Part with IPN "R-1000" exists | `200 OK`; results contain only the exact-match part(s). | P1 | Positive |
| API-F-03 | Filter by category id | `GET /api/part/?category=<id>` | Category has known parts | `200 OK`; every result's `category` equals `<id>`. | P1 | Positive |
| API-F-04 | Filter by category with cascade | `GET /api/part/?category=<parentId>&cascade=true` | Parent category has a sub-category with parts | `200 OK`; results include parts from both the parent and sub-categories. | P2 | Positive |
| API-F-05 | Filter by category=null | `GET /api/part/?category=null` | Uncategorised parts exist | `200 OK`; results only include parts with `category=null`. | P2 | Boundary |
| API-F-06 | Boolean functional filter | `GET /api/part/?assembly=true` | Assembly and non-assembly parts both exist | `200 OK`; every result has `assembly=true`. | P1 | Positive |
| API-F-07 | Combined filters (AND semantics) | `GET /api/part/?assembly=true&active=true` | Mixed parts exist | `200 OK`; every result satisfies both conditions simultaneously. | P2 | Positive |
| API-F-08 | Pagination — limit/offset | `GET /api/part/?limit=5&offset=0` then `?limit=5&offset=5` | 10+ parts exist | Each call returns `200 OK` with ≤5 results; the two pages contain no overlapping `pk` values; `count` is identical across both calls. | P1 | Positive |
| API-F-09 | Pagination — offset beyond result count | `GET /api/part/?limit=5&offset=100000` | Fewer than 100000 parts exist | `200 OK`; `results` is an empty array; `count` still reflects the true total. | P2 | Boundary |
| API-F-10 | Ordering ascending/descending | `GET /api/part/?ordering=name` then `?ordering=-name` | 3+ parts with distinct names exist | `200 OK`; results sorted alphabetically ascending, then descending respectively. | P2 | Positive |
| API-F-11 | Invalid filter value ignored or errors gracefully | `GET /api/part/?created_after=not-a-date` | — | Either `400 Bad Request` with a clear error, or the filter is ignored and full results returned — must not `500`; assert actual behaviour. | P2 | Negative |
| API-F-12 | Regex filter on name | `GET /api/part/?name_regex=^Resistor.*` | Parts named "Resistor 10k", "Capacitor 1nF" exist | `200 OK`; only names matching the regex are returned. | P3 | Positive |
| API-F-13 | Detail expansion flags include nested data | `GET /api/part/?category_detail=true` | Parts have a category set | `200 OK`; each result includes a nested `category_detail` object instead of (or alongside) the bare `category` id. | P2 | Positive |

## 4. Field-Level Validation

| ID | Title | Request | Preconditions | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| API-V-01 | Missing required field `name` | `POST /api/part/` body `{}` | — | `400 Bad Request`; error payload keyed under `name` (e.g. "This field is required."). | P1 | Negative |
| API-V-02 | Name exceeds max length | `POST /api/part/` body `{"name": "<101 chars>"}` | — | `400 Bad Request`; error indicates max length (100) exceeded. | P2 | Boundary |
| API-V-03 | Name at exact max length boundary | `POST /api/part/` body `{"name": "<exactly 100 chars>"}` | — | `201 Created`; name persisted at full length. | P2 | Boundary |
| API-V-04 | Description exceeds max length | `POST /api/part/` body with `description` of 251 chars | — | `400 Bad Request`. | P2 | Boundary |
| API-V-05 | Nullable field accepts null | `PATCH /api/part/{id}/` body `{"category": null}` | Part currently has a category | `200 OK`; `category` becomes `null`. | P2 | Positive |
| API-V-06 | Non-nullable field rejects null | `PATCH /api/part/{id}/` body `{"name": null}` | Part exists | `400 Bad Request`; error indicates `name` may not be null. | P2 | Negative |
| API-V-07 | Read-only field write is ignored/rejected | `PATCH /api/part/{id}/` body `{"in_stock": 9999}` | Part exists with a known `in_stock` value | Response is `200` (field silently ignored, value unchanged on re-fetch) or `400` (rejected as read-only) — assert the part's actual `in_stock` value is **not** altered by this request either way. | P2 | Negative |
| API-V-08 | Invalid type for boolean field | `POST /api/part/` body `{"name": "X", "assembly": "yes"}` | — | `400 Bad Request`; error indicates `assembly` must be a valid boolean. | P3 | Negative |
| API-V-09 | Foreign key field with non-existent id | `POST /api/part/` body `{"name": "X", "category": 999999999}` | — | `400 Bad Request`; error indicates the referenced category does not exist. | P1 | Negative |
| API-V-10 | Minimum stock rejects negative value | `POST /api/part/` body `{"name": "X", "minimum_stock": -1}` | — | `400 Bad Request`. | P2 | Boundary |
| API-V-11 | `revision_of` pointing to a template part rejected | `POST /api/part/` body `{"name": "X", "revision_of": <templatePartId>}` | Target part has `is_template=true` | `400 Bad Request`; error indicates template parts cannot be revisioned. | P1 | Negative |
| API-V-12 | `revision_of` pointing to self rejected | `PATCH /api/part/{id}/` body `{"revision_of": <id>}` (own id) | Part exists | `400 Bad Request`. | P1 | Negative |
| API-V-13 | Duplicate `revision` under same `revision_of` rejected | `POST /api/part/` body `{"name": "X", "revision_of": <id>, "revision": "B"}` | Another part already has `revision_of=<id>, revision="B"` | `400 Bad Request`; error indicates duplicate revision code. | P1 | Negative |

## 5. Relational Integrity

| ID | Title | Request | Preconditions | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| API-R-01 | Part correctly linked to its category | `POST /api/part/` with valid `category`, then `GET /api/part/{id}/?category_detail=true` | Category exists | Response's `category` equals the id supplied; `category_detail.name` matches the category's actual name. | P1 | Positive |
| API-R-02 | Changing a part's category updates category-scoped listing | `PATCH /api/part/{id}/` body `{"category": <newCategoryId>}`, then `GET /api/part/?category=<newCategoryId>` | Two categories exist | Part now appears in the new category's filtered list and no longer in the old category's filtered list. | P1 | Positive |
| API-R-03 | Default location inherited from category when unset | `POST /api/part/` with `category=<id>` set, `default_location` omitted | Category has a `default_location` configured | Created part's `default_location` reflects the category default (or is `null` with inheritance resolved at read-time, per actual instance behaviour — assert the observed contract). | P2 | Positive |
| API-R-04 | Supplier linkage requires `purchaseable=true` | `POST /api/company/{supplierId}/supplier-part/` (or equivalent) referencing a part with `purchaseable=false` | Non-purchaseable part exists | `400 Bad Request`; error indicates the part must be purchaseable to link a supplier part. | P2 | Negative |
| API-R-05 | Deleting a category reassigns or blocks based on contained parts | `DELETE /api/part/category/{id}/` | Category has parts assigned | Response matches API-C-06's documented contract; a follow-up `GET /api/part/{partId}/` confirms the part's `category` field reflects the actual post-delete state (reassigned or category set null), not an orphaned reference to a deleted id. | P1 | Negative |
| API-R-06 | BOM line references an existing component part | `POST /api/bom-item/` body referencing `part=<assemblyId>, sub_part=<componentId>` | Assembly and component parts exist, component has `component=true` | `201 Created`; `GET /api/part/{assemblyId}/` (or BOM list) shows the new line. | P2 | Positive |
| API-R-07 | BOM line rejects non-component sub_part | `POST /api/bom-item/` body with `sub_part=<id>` where that part has `component=false` | — | `400 Bad Request`; error indicates the sub-part is not flagged as usable as a component. | P2 | Negative |

## 6. Edge Cases — Auth, Payloads, Conflicts

| ID | Title | Request | Preconditions | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| API-E-01 | Unauthenticated request to protected endpoint | `POST /api/part/` with no `Authorization` header | — | `401 Unauthorized`. | P1 | Negative |
| API-E-02 | Unauthenticated GET on a list that requires auth | `GET /api/part/` with no `Authorization` header | Instance configured to require auth for read | `401 Unauthorized` (or `200` if anonymous read is enabled per instance config — assert against the actual instance's `ANONYMOUS_ACCESS` setting). | P2 | Negative |
| API-E-03 | Authenticated but insufficient permission | `POST /api/part/` using a token for a read-only role user | Read-only user/token provisioned | `403 Forbidden`. | P1 | Negative |
| API-E-04 | Invalid/expired token rejected | `GET /api/part/` with `Authorization: Token invalidtoken123` | — | `401 Unauthorized`. | P2 | Negative |
| API-E-05 | Malformed JSON payload | `POST /api/part/` with body `{"name": "X",` (truncated/invalid JSON) | — | `400 Bad Request`; parser error, not a `500`. | P2 | Negative |
| API-E-06 | Wrong Content-Type header | `POST /api/part/` with `Content-Type: text/plain` and a JSON string body | — | `400`/`415`-class response; not a `500`, and no part is created. | P3 | Negative |
| API-E-07 | Extremely large payload / oversized field | `POST /api/part/` with `description` of 100,000 characters | — | `400 Bad Request` (max length violation); server does not hang or crash. | P3 | Boundary |
| API-E-08 | Concurrent update race — last-write-wins vs conflict detection | Two near-simultaneous `PATCH /api/part/{id}/` requests changing the same field to different values | Part exists | Response for both requests is `200`; final `GET` reflects one deterministic winner consistent with server processing order — no data corruption or partial write. | P3 | Negative |
| API-E-09 | Idempotency of DELETE on already-deleted resource | `DELETE /api/part/{id}/` called twice in succession | Part exists initially | First call → `204`. Second call → `404` (resource no longer exists). | P2 | Boundary |
| API-E-10 | Method not allowed on a read-only sub-resource | `DELETE /api/part/{id}/pricing/` | Part exists | `405 Method Not Allowed`. | P3 | Negative |
| API-E-11 | Cross-field conflict: creating a variant of a non-template part | `POST /api/part/` body `{"name": "X", "variant_of": <id>}` where target part has `is_template=false` | — | `400 Bad Request`; error indicates the target part is not a template. | P2 | Negative |
| API-E-12 | SQL/NoSQL injection-style input in search is neutralised | `GET /api/part/?search=' OR '1'='1` | — | `200 OK`; input treated as a literal search string (no results matching, or benign match); no server error, no data leak. | P2 | Negative |

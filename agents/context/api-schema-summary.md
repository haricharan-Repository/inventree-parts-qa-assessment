# InvenTree Parts API — Schema Summary (ingested from docs)

Source: `https://docs.inventree.org/en/stable/api/schema/part/`, fetched via `WebFetch` on
2026-09-07. InvenTree's live API additionally self-documents at `/api/schema/redoc/` and
`/api/schema/swagger-ui/` on a running instance — cross-checked field names there where the
static docs page was ambiguous. Base API root: `/api/`.

**Update (2026-09-07, after standing up a live instance):** several endpoint paths and
behaviours guessed from the static docs turned out to be wrong or incomplete. Corrections are
marked **[verified live]** inline below; see `automation/api/README.md` → "Corrections made
against the live instance" for the full list and how each was found.

## 1. Core Endpoints

| Method(s) | Path | Purpose |
|---|---|---|
| GET, POST | `/api/part/` | List / create parts |
| GET, PATCH, PUT, DELETE | `/api/part/{id}/` | Retrieve / update / delete a part |
| GET | `/api/part/{id}/pricing/` | Pricing summary |
| GET | `/api/part/{id}/requirements/` | Build/sales order requirements |
| GET | `/api/part/{id}/serial-numbers/` | Serial number data (trackable parts) |
| POST | `/api/part/{id}/bom-copy/` | Copy BOM from another part |
| GET, PATCH, PUT | `/api/part/{id}/bom-validate/` | Validate BOM checksum |
| GET, POST | `/api/part/category/` | List / create categories |
| GET | `/api/part/category/tree/` | Hierarchical category tree |
| GET, PATCH, PUT, DELETE | `/api/part/category/{id}/` | Retrieve / update / delete a category |
| GET, POST | `/api/part/category/parameters/` | Category-level parameter templates |
| GET, POST | `/api/part/parameter/` | Part parameter values |
| GET, POST | `/api/parameter/template/` | Parameter templates **[verified live — not `/api/part/parameter/template/` as originally guessed]** |
| GET, POST | `/api/part/test-template/` | Test templates |
| GET, POST | `/api/bom/` | BOM lines **[verified live — not `/api/part/bom-item/` as originally guessed]** |
| GET, POST | `/api/part/related/` | Related-parts links |
| GET | `/api/part/thumbs/` | Part image thumbnails |
| GET, POST | `/api/part/internal-price/`, `/api/part/sale-price/` | Pricing tiers |
| GET | `/api/part/stocktake/` | Stocktake records |

## 2. Part — Field Reference (from schema + confirmed against OpenAPI on a running instance)

| Field | Type | Required (POST) | Read-only | Notes |
|---|---|---|---|---|
| `pk` | integer | — | yes | |
| `name` | string, max 100 | yes | no | |
| `description` | string, max 250 | no | no | |
| `IPN` | string, max 100 | no | no | uniqueness gated by global setting `PART_IPN_ALLOW_DUPLICATE` |
| `revision` | string, max 100 | no | no | |
| `revision_of` | integer (FK), nullable | no | no | must not equal `pk`; target must not itself be a template |
| `category` | integer (FK), nullable | no | no | |
| `keywords` | string | no | no | |
| `link` | string (URL) | no | no | |
| `units` | string | no | no | must be a recognised pint unit or custom unit |
| `default_location` | integer (FK), nullable | no | no | |
| `minimum_stock` | decimal | no | no | ≥ 0 |
| `active` | boolean | no | no | default true |
| `locked` | boolean | no | no | |
| `virtual` | boolean | no | no | |
| `is_template` | boolean | no | no | true blocks `revision_of` being set |
| `assembly` | boolean | no | no | |
| `component` | boolean | no | no | |
| `consumable` | boolean | no | no | |
| `trackable` | boolean | no | no | |
| `testable` | boolean | no | no | |
| `purchaseable` | boolean | no | no | |
| `salable` | boolean | no | no | |
| `barcode_hash`, `full_name`, `category_name`, `starred`, `thumbnail`, `in_stock`, `allocated_to_build_orders`, `allocated_to_sales_orders`, `building`, `external_stock`, `total_in_stock`, `unallocated_stock`, `variant_stock`, `pricing_min`, `pricing_max`, `pricing_updated` | mixed | — | **yes** | computed / derived — must reject client writes |

## 3. Part Category — Field Reference

| Field | Type | Required | Read-only | Notes |
|---|---|---|---|---|
| `pk` | integer | — | yes | |
| `name` | string, max 100 | yes | no | |
| `description` | string | no | no | |
| `parent` | integer (FK), nullable | no | no | must not create a cycle |
| `default_location` | integer (FK), nullable | no | no | |
| `default_keywords` | string | no | no | |
| `structural` | boolean | no | no | when true, parts cannot be assigned directly to this category |
| `icon` | string | no | no | |
| `part_count`, `level`, `pathstring` | mixed | — | yes | computed |

## 4. Filtering, Search & Pagination — `GET /api/part/`

**Search**: `search=<text>` — full-text across IPN, name, description, keywords,
manufacturer/supplier part numbers, tags.

**Exact / pattern filters**: `IPN=`, `IPN_regex=`, `name_regex=`, `category=<id>|null`,
`cascade=true|false` (include child categories).

**Boolean/functional filters**: `active`, `locked`, `starred`, `is_template`, `is_variant`,
`assembly`, `component`, `consumable`, `purchaseable`, `salable`, `trackable`, `testable`.

**Stock-state filters**: `has_stock`, `low_stock`, `high_stock`, `depleted_stock`,
`unallocated_stock`.

**Relationship filters**: `variant_of=<id>`, `revision_of=<id>`, `in_bom_for=<id>`.

**Date filters**: `created_after`, `created_before`.

**Expansion flags**: `category_detail`, `location_detail`, `path_detail`, `parameters`,
`price_breaks`, `tags` (booleans — include nested related objects in the response).

**Pagination**: `limit`, `offset` (DRF `LimitOffsetPagination`); response envelope is
`{ "count": <int>, "next": <url|null>, "previous": <url|null>, "results": [...] }`
**only when `limit` (or `offset`) is present on the request [verified live]** — a bare
`GET /api/part/` with no pagination params returns a plain JSON array of every matching part,
not the envelope. Any client that reads `.results` unconditionally will break on an unpaginated
call; always pass `limit=`.

**Ordering**: `ordering=<field>` / `ordering=-<field>` (e.g. `ordering=name`,
`ordering=-in_stock`).

## 5. Auth & Access Control

- Token or session auth (`Authorization: Token <key>` or DRF session cookie); a running instance
  also supports `/api/user/token/` to mint a token from username/password for scripting.
- Unauthenticated requests to write endpoints → `401 Unauthorized`; authenticated-but-insufficient
  role/permission → `403 Forbidden`.
- Per-model permission enforcement (view/add/change/delete) is role-based — a read-only user
  should get `200` on GET but `403` on POST/PATCH/DELETE.

## 6. Conflict / Integrity Scenarios (feed into Phase 2 negative tests)

- `POST /api/part/` with `name` missing → `400`, field-level error under `name`.
- `POST /api/part/` with `category` pointing at a non-existent id → `400`.
- `POST /api/part/` with `revision_of` = own future `pk` or a template part → `400`.
- `POST /api/part/category/` with `parent` set to itself or a descendant (cycle) → `400`.
- `DELETE /api/part/{id}/` is rejected with `400` (`"Cannot delete this part as it is still
  active"`) **whenever the part is `active=true` — unconditionally, regardless of whether
  anything actually references it [verified live]**. Deactivate first (`PATCH {active: false}`),
  then delete. A **BOM reference still blocks deletion even once inactive** (`400`) — confirmed
  live; a stock reference alone does **not** block deletion once inactive (`204`) — this
  contradicts the natural assumption (by analogy with the BOM case) that stock references would
  also block deletion, so don't assume it without checking a running instance.
- `DELETE /api/part/category/{id}/` **requires a JSON body** — `delete_child_categories` and
  `delete_parts` (both required booleans) — **[verified live]**. A bodyless DELETE returns `400`
  ("This field is required") and deletes nothing; this is not documented on the static schema
  page. With both `false`, the category is deleted and any contained parts/subcategories are
  reassigned to its parent (or root), not deleted.
- Duplicate IPN with `PART_IPN_ALLOW_DUPLICATE=false` → `400`.
- Writing a read-only field (e.g. `in_stock`) is silently ignored — the value is unchanged on
  re-fetch, and the response is still `200` **[verified live]**.
- A user created directly via the Django ORM (bypassing normal registration) has no
  `UserProfile` row, and `GET /api/user/token/` for that user crashes with a `500`
  (`RelatedObjectDoesNotExist: User has no profile`) rather than a clean auth error
  **[verified live]** — create `UserProfile.objects.get_or_create(user=u)` alongside any
  shell-created test user.

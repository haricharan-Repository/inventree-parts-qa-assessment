# InvenTree Parts Module — Requirements Summary (ingested from docs)

Source pages fetched via `WebFetch` on 2026-09-07 from `https://docs.inventree.org/en/stable/`:

- `/part/` — main Parts overview
- `/part/views/` — Part detail view tabs, creation fields
- `/part/template/` — Template parts & Variants
- `/part/revision/` — Part Revisions
- `/part/test/` — Test Templates
- `/concepts/parameters/` — Part Parameters
- `/concepts/units/` — Units of measure

Two guessed sub-paths (`/part/category/`, `/part/creation/`) 404'd — Part Categories and
detailed creation/import-flow behaviour below are supplemented with documented InvenTree
domain knowledge where the fetched pages were sparse; these supplemented points are marked
**[inferred]** and should be re-verified against a running instance during Phase 1 UI walkthroughs.

## 1. Core Part Concept

- The Part is InvenTree's core domain entity; it acts as the archetype for stock items.
- Parts are organised hierarchically inside Part Categories.
- A part's total stock = sum of all associated stock items across locations.
- `minimum_stock` / `maximum_stock` drive "low stock" / "overstocked" flags.
- Parts can be **locked** to prevent modification while referenced by active production.

## 2. Part Attributes (boolean flags)

| Attribute | Meaning |
|---|---|
| Virtual | Intangible item (process, license, machine time) — no physical stock |
| Template | Enables Variants beneath this part |
| Assembly | Built from component parts via a BOM |
| Component | Usable as a sub-component inside other assemblies |
| Testable | Supports recording test results against stock items |
| Trackable | Enables batch / serial number assignment |
| Purchaseable | Can be linked to supplier parts and purchase orders |
| Salable | Can be added to sales orders |
| Active / Inactive | Inactive parts stay in the DB but are excluded from most selectable actions (BOM, POs, SOs) |
| Consumable | Assembly BOM line is consumed without individual stock tracking **[inferred]** |
| Locked | Prevents edits/deletion while referenced by production |

## 3. Part Creation — Fields

| Field | Required | Notes |
|---|---|---|
| Name | Yes | Text label. Docs state Name is (effectively) unique in combination with IPN+Revision |
| IPN (Internal Part Number) | No | Optional identifier; duplicate IPNs are allowed unless the "Require unique IPN" global setting is enabled **[inferred: setting name]** |
| Description | No | Free text |
| Revision | No | Version code; see §5 Revisions |
| Category | No (but strongly recommended) | Determines default location/parameters inheritance |
| Keywords | No | Search optimisation |
| External Link | No | URL to external docs |
| Units of Measure | No | Defaults to "pcs" |
| Default Location | No | Inherited from category if unset **[inferred]** |
| Attribute flags (§2) | No | Default per global part settings |
| Image | No | Auto-generates thumbnail |

**Import flow**: InvenTree provides a generic Data Import wizard (CSV/Excel) that maps
spreadsheet columns to Part fields, validates rows, and reports per-row errors before commit
**[inferred, generic Data Import concept referenced from `/concepts/data_import/`]**.

## 4. Part Detail View — Tabs

| Tab | Visible when | Content |
|---|---|---|
| Stock | always | Stock items: quantity, location, status; create/export/bulk actions |
| BOM | `assembly = true` | Sub-components with required quantities |
| Allocated | `component` or `salable` | Units reserved against build orders / sales orders |
| Build Orders | always (if any builds exist) | Builds referencing this part: qty, status, dates |
| Parameters | always | Custom parameter values (see §6) |
| Variants | `is_template = true` | Variant parts derived from this template |
| Revisions | part has revisions | Selector between sibling revisions |
| Attachments | always | Files (datasheets, docs) |
| Related Parts | always | Explicit part-to-part relationships |
| Test Templates | `testable = true` | Required tests for stock instances (see §7) |
| Pricing / Suppliers / Purchase Orders / Sales Orders | conditional on Purchaseable/Salable | Commercial data |

## 5. Part Revisions

- A revision is itself a full Part (own stock, own BOM) linked via a `revision_of` FK to the
  original part.
- **Creation**: Part actions menu → "Duplicate Part" → set `Revision Of` = original part, set a
  unique `Revision` value → submit.
- **Constraints**:
  - A part cannot be a revision of itself (no circular reference).
  - Two revisions of the same part cannot share the same revision code (unique per `revision_of`).
  - **Template parts cannot have revisions** — revision-of-revision / revision-of-template must
    be rejected.
  - Variant parts *can* have revisions, but the revision must reference the same template as the
    original variant ("template alignment").
  - Stock items, build orders and purchase orders tied to the original part are unaffected by
    creating a new revision.
- When multiple revisions exist, the UI shows a revision-switcher dropdown on the part page.

## 6. Part Parameters

- **Parameter Templates** (admin-defined) specify a parameter's name, optional units, optional
  choices/selection list, and applicability (specific part categories or global).
- **Values**: a Part Parameter is a (part, template, data) triple. Optional unless the template
  marks it required.
- **Units-aware validation**: if the template declares units, entered values must be
  dimensionally compatible (pint library) and are normalised for sorting/comparison
  (e.g. "10k" Ω vs "10000" Ω compare equal).
- **Uniqueness levels** (per template): none / unique-per-part-model / globally unique. Category
  default values cannot be applied to unique-constrained parameters (would create automatic
  duplicate conflicts).
- **Parametric tables**: category/part list views can add parameter columns, filter with
  operators (`=`, `>`, `<`, `contains`, `!=`) including unit-aware filtering across compatible
  dimensions, and sort by parameter value.

## 7. Test Templates (Testable parts)

- Only available when `testable = true`.
- Fields: `test_name` (unique per part; auto-derived `key` — lowercase alphanumeric, valid
  Python identifier), `required`, `requires_value`, `requires_attachment`, `enabled`.
- Templates cascade to variant parts of a template automatically.
- Disabling (rather than deleting) a template preserves historical test-result data.
- Individual stock items record Test Results against these templates.

## 8. Template Parts & Variants

- Toggling `is_template = true` on a part enables the Variants tab and lets child parts be
  created as Variants of it (Variants tab → "New Variant" → duplication form).
- Variants in a template relationship must use **unique serial numbers across all variants**
  (shared serial pool), distinct from the ordinary category/part hierarchy.
- A template part's Stock tab reports **consolidated stock** across itself and all variants.
- Used for configurable products (e.g. same base part, different colour/spec options) without
  duplicating core part data.

## 9. Part Categories **[largely inferred — source pages 404'd]**

- Categories form a parent/child tree; a part optionally belongs to exactly one category.
- Categories can define default values inherited by parts created within them: default
  location, default keywords, default parameter templates.
- "Structural" categories (**[inferred]**) may restrict direct part assignment, only allowing
  parts in leaf sub-categories.
- Category list/tree view supports filtering, and (per §6) parametric table columns for parts
  within a category.
- Category tree exposed via `GET /api/part/category/tree/` (confirmed via API schema fetch).

## 10. Units of Measure

- Implemented on top of the Python **pint** library — real physical dimensions, not just labels.
- Accepts engineering notation (`10k3` = 10300), scientific notation (`1E3` = 1000), and
  imperial shorthand (`3'`, `6"`).
- **Case-sensitive** (`kg` ≠ `KG`).
- Built-in dimensionless counting units: piece, dozen, hundred, thousand.
- Custom units configurable in Settings → Physical Units; dimensionless custom units must
  define themselves as `1`.
- Unit conversion is enforced to be dimensionally compatible (mass ↔ mass only, etc.) — supplier
  pack quantities vs internal stock quantities are validated against this.

## 11. Negative / Boundary Scenarios Called Out by the Assessment

These are explicitly required by the brief and are cross-referenced into the manual test suite:

- Duplicate IPN (behaviour depends on the "require unique IPN" setting — test both states)
- Inactive part restrictions (cannot be added to new BOMs/POs/SOs while inactive)
- Revision-of-revision prevention
- Revision-of-template prevention
- Circular revision reference prevention
- Duplicate revision code under the same `revision_of` parent
- Unit-incompatible parameter values rejected
- Required parameter left blank

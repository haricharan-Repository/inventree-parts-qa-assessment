# InvenTree Parts Module — UI Manual Test Cases

**Source of truth:** [`agents/context/parts-requirements-summary.md`](../agents/context/parts-requirements-summary.md)
(ingested from `docs.inventree.org/en/stable/part/*` and `concepts/parameters|units`).

**Legend** — Priority: P1 (blocker/critical) · P2 (major) · P3 (minor/edge).
Type: Positive · Negative · Boundary.

Preconditions common to all cases unless overridden: logged in as a user with full Parts
permissions; at least one Part Category exists ("Electronics" used as the example category
throughout).

---

## 1. Part Creation — Manual Entry

| ID | Title | Preconditions | Steps | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| PC-01 | Create part with required fields only | Category "Electronics" exists | 1. Parts → New Part. 2. Enter Name = "Resistor 10k". 3. Leave all optional fields blank. 4. Save. | Part is created; detail page opens; Name shown; optional fields show as empty/default (units = "pcs", active = true). | P1 | Positive |
| PC-02 | Create part with all fields populated | — | 1. New Part. 2. Fill Name, IPN, Description, Revision, Category, Keywords, External Link, Units, Default Location, Minimum Stock. 3. Save. | Part created; every entered field persisted and displayed correctly on detail page. | P1 | Positive |
| PC-03 | Name is required | — | 1. New Part. 2. Leave Name blank, fill other fields. 3. Save. | Form blocks submission; inline validation error on Name field ("This field is required"). | P1 | Negative |
| PC-04 | Duplicate IPN allowed when duplicates permitted | Global setting "Allow duplicate IPN" = enabled; an existing part has IPN "R-1000" | 1. New Part. 2. Name = "Resistor Dup". 3. IPN = "R-1000". 4. Save. | Part is created successfully; no uniqueness error. | P2 | Positive |
| PC-05 | Duplicate IPN rejected when duplicates disallowed | Global setting "Allow duplicate IPN" = disabled; an existing part has IPN "R-1000" | 1. New Part. 2. Name = "Resistor Dup2". 3. IPN = "R-1000". 4. Save. | Save is blocked; error message indicates IPN must be unique. | P1 | Negative |
| PC-06 | Assign category on creation | Category tree has "Electronics > Passives" | 1. New Part. 2. Name = "Capacitor 100nF". 3. Category = "Electronics > Passives". 4. Save. | Part created under selected category; category breadcrumb visible on detail page; part appears in category's part list. | P1 | Positive |
| PC-07 | Create part with no category | — | 1. New Part. 2. Name only, Category left unset. 3. Save. | Part created with no category (or root/"Uncategorised" bucket per config); part is still creatable and viewable. | P2 | Boundary |
| PC-08 | Units of measure default | — | 1. New Part. 2. Name only, leave Units blank. 3. Save. | Units field defaults to "pcs" on the detail page. | P3 | Positive |
| PC-09 | Invalid/incompatible unit rejected | — | 1. New Part. 2. Name = "Test Unit Part". 3. Units = "notaunit". 4. Save. | Save blocked; error indicating the unit is not a recognised physical/custom unit. | P2 | Negative |
| PC-10 | Name field max length enforced | — | 1. New Part. 2. Name = a string of 101 characters (limit is 100). 3. Save. | Client and/or server rejects the value; error indicates max length exceeded, or input is truncated to 100 chars per UI behaviour — verify against running instance and record actual behaviour. | P3 | Boundary |
| PC-11 | External link accepts a valid URL | — | 1. New Part. 2. Name only. 3. External Link = "https://example.com/datasheet.pdf". 4. Save. | Part saved; link rendered as a clickable external link on detail page. | P3 | Positive |
| PC-12 | Cancel part creation discards changes | — | 1. New Part. 2. Fill Name and other fields. 3. Click Cancel (not Save). | No part is created; user returns to the parts list; no new row present. | P3 | Negative |

## 2. Part Creation — Import Flow

| ID | Title | Preconditions | Steps | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| PI-01 | Import valid part spreadsheet | Prepared CSV with valid rows: Name, IPN, Category, Units | 1. Parts → Import. 2. Upload CSV. 3. Map columns to Part fields. 4. Review preview. 5. Confirm import. | All valid rows are created as parts; success summary shows row count imported; parts visible in list. | P1 | Positive |
| PI-02 | Import preview flags invalid rows | CSV contains one row missing Name | 1. Parts → Import. 2. Upload CSV. 3. Map columns. 4. Review preview. | Preview marks the invalid row with an inline error ("Name is required") before commit; valid rows are still importable. | P1 | Negative |
| PI-03 | Import rejects unmapped required field | CSV has no column that can map to Name | 1. Import wizard → column mapping step. 2. Leave Name unmapped. 3. Attempt to proceed. | Wizard blocks progression to preview/commit until Name is mapped. | P2 | Negative |
| PI-04 | Import with duplicate IPNs (duplicates disallowed) | Global "Allow duplicate IPN" disabled; CSV has two rows with the same IPN, and one IPN already exists in DB | 1. Import CSV. 2. Review preview. 3. Commit. | Rows violating IPN uniqueness are rejected/flagged; non-conflicting rows are imported; summary reports partial success with reasons. | P2 | Negative |
| PI-05 | Cancel import mid-wizard | — | 1. Start import, upload file, reach mapping step. 2. Click Cancel/Close. | No parts are created; wizard closes; parts list unchanged. | P3 | Negative |
| PI-06 | Import large file (boundary row count) | CSV with e.g. 500+ rows | 1. Upload large CSV. 2. Map columns. 3. Commit. | Import completes (possibly async/background); progress indicator shown; final count of created parts matches valid row count. | P3 | Boundary |

## 3. Part Detail View — Tabs

| ID | Title | Preconditions | Steps | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| PDV-01 | Stock tab lists all stock items | Part has 2+ stock items in different locations | 1. Open part detail. 2. Select Stock tab. | All stock items listed with quantity, location, status; total matches sum shown on part header. | P1 | Positive |
| PDV-02 | Stock tab — create new stock item | On Stock tab | 1. Click "New Stock Item". 2. Enter quantity and location. 3. Save. | New stock item appears in the list; part's total in-stock quantity increases accordingly. | P1 | Positive |
| PDV-03 | BOM tab hidden for non-assembly part | Part has `assembly = false` | 1. Open part detail. | BOM tab is not shown (or shown disabled) in the tab bar. | P2 | Negative |
| PDV-04 | BOM tab shows components for assembly part | Part has `assembly = true` with 2 BOM lines | 1. Open part detail → BOM tab. | Sub-components listed with required quantity per line; totals correct. | P1 | Positive |
| PDV-05 | Add BOM line | Part is an assembly | 1. BOM tab → Add Line. 2. Select a component part, quantity = 3. 3. Save. | New BOM line appears with correct component and quantity. | P1 | Positive |
| PDV-06 | Allocations tab shows build/sales order reservations | Part is `component=true`, has stock allocated to an active build order | 1. Open part detail → Allocations tab. | Allocated quantity and the referencing build/sales order are listed. | P2 | Positive |
| PDV-07 | Allocations tab hidden for non-component, non-salable part | Part has `component=false`, `salable=false` | 1. Open part detail. | Allocations tab not shown. | P3 | Negative |
| PDV-08 | Build Orders tab lists related builds | Part has 1+ build order referencing it | 1. Open part detail → Build Orders tab. | Builds listed with quantity, status, created/completed dates. | P2 | Positive |
| PDV-09 | Parameters tab lists parameter values | Part has 2 parameter values assigned | 1. Open part detail → Parameters tab. | Parameter name, value, and units (if any) displayed per row. | P1 | Positive |
| PDV-10 | Add a parameter value | Parameter template "Resistance" exists with units "ohm" | 1. Parameters tab → Add Parameter. 2. Select template "Resistance". 3. Value = "10k". 4. Save. | Row added showing normalised value; sortable/filterable against other resistance values elsewhere. | P1 | Positive |
| PDV-11 | Parameter value rejected for incompatible unit | Template "Resistance" (ohm) | 1. Add Parameter → Resistance. 2. Value = "5 kg". 3. Save. | Save blocked; error indicates unit is dimensionally incompatible. | P2 | Negative |
| PDV-12 | Required parameter cannot be left blank | Template "Voltage Rating" marked required | 1. Add Parameter → Voltage Rating. 2. Leave value blank. 3. Save. | Save blocked; validation error on value field. | P2 | Negative |
| PDV-13 | Variants tab hidden for non-template part | Part has `is_template = false` | 1. Open part detail. | Variants tab not shown. | P2 | Negative |
| PDV-14 | Variants tab lists variants for template part | Part has `is_template = true` with 2 variants | 1. Open part detail → Variants tab. | Variant parts listed with links to each variant's detail page. | P1 | Positive |
| PDV-15 | Create new variant from Variants tab | Template part open | 1. Variants tab → New Variant. 2. Complete duplication form (name/attributes). 3. Save. | New part created, linked as a variant of the template; appears in Variants tab list. | P1 | Positive |
| PDV-16 | Template stock aggregates variant stock | Template has 2 variants, each with stock | 1. Open template part → Stock tab (or header total). | Total stock shown includes template's own stock plus all variants' stock, consolidated. | P2 | Positive |
| PDV-17 | Revisions tab / selector shown when revisions exist | Part has 2 revisions (Rev A, Rev B) | 1. Open Rev A's detail page. | A revision-switcher control is visible; selecting Rev B navigates to Rev B's detail page. | P1 | Positive |
| PDV-18 | Revisions control hidden for a part with no revisions | Part has no `revision_of` links | 1. Open part detail. | No revision switcher displayed. | P3 | Negative |
| PDV-19 | Attachments tab — upload a file | Open any part | 1. Attachments tab → Upload. 2. Choose a PDF file. 3. Confirm. | File appears in the attachments list with filename, size, uploaded-by, date. | P2 | Positive |
| PDV-20 | Attachments tab — delete a file | Part has an existing attachment | 1. Attachments tab. 2. Select attachment → Delete. 3. Confirm. | Attachment removed from the list; not downloadable afterward. | P3 | Positive |
| PDV-21 | Related Parts tab — add a relationship | Two existing parts A and B | 1. Open Part A → Related Parts tab → Add Related Part. 2. Select Part B. 3. Save. | Relationship listed on Part A's Related Parts tab; reciprocal link visible on Part B's tab. | P3 | Positive |
| PDV-22 | Test Templates tab hidden for non-testable part | Part has `testable = false` | 1. Open part detail. | Test Templates tab not shown. | P2 | Negative |
| PDV-23 | Add a required test template | Part has `testable = true` | 1. Test Templates tab → Add Test. 2. Name = "Continuity Check". 3. Required = true. 4. Save. | Test template created; auto-generated test key shown (lowercase, alphanumeric, valid identifier, e.g. "continuitycheck"). | P1 | Positive |
| PDV-24 | Duplicate test template name rejected | Existing test "Continuity Check" on this part | 1. Add Test → Name = "Continuity Check" again. 2. Save. | Save blocked; error indicating test name must be unique per part. | P2 | Negative |
| PDV-25 | Disable (not delete) a test template with history | Test template has recorded results on stock items | 1. Test Templates tab → select test → Disable. | Template marked disabled/inactive; historical test results remain visible on affected stock items. | P2 | Positive |
| PDV-26 | Test requiring attachment enforces upload on stock test result | Test template has `requires_attachment = true` | 1. On a stock item, record a test result for this template without attaching a file. 2. Save. | Save blocked; error requires a file attachment for this test result. | P2 | Negative |

## 4. Part Categories

| ID | Title | Preconditions | Steps | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| CAT-01 | Create a top-level category | — | 1. Categories → New Category. 2. Name = "Mechanical", no parent. 3. Save. | Category created at tree root; visible in category navigation tree. | P1 | Positive |
| CAT-02 | Create a nested sub-category | Category "Mechanical" exists | 1. New Category. 2. Name = "Fasteners". 3. Parent = "Mechanical". 4. Save. | Sub-category created under "Mechanical" in the tree; breadcrumb shows "Mechanical > Fasteners". | P1 | Positive |
| CAT-03 | Category tree navigation expands/collapses correctly | Multi-level category tree exists | 1. Open Categories view. 2. Expand/collapse nodes at various levels. | Tree expands/collapses without losing sibling state; part counts per category shown correctly. | P2 | Positive |
| CAT-04 | Filter parts list by category | Category "Electronics" has 5 parts, other categories have parts too | 1. Parts list → filter by Category = "Electronics". | Only parts belonging to "Electronics" (and optionally sub-categories, depending on cascade toggle) are shown. | P1 | Positive |
| CAT-05 | Cascade filter includes sub-category parts | "Electronics" has sub-category "Passives" with parts | 1. Filter Category = "Electronics", enable "include sub-categories"/cascade. | Parts from both "Electronics" and "Passives" are shown. | P2 | Positive |
| CAT-06 | Parametric table shows parameter columns per category | Category parts share parameter template "Resistance" | 1. Open category part list. 2. Add "Resistance" as a table column. | Column renders each part's resistance value; sortable and filterable by that column. | P2 | Positive |
| CAT-07 | Structural category blocks direct part assignment | Category "Assemblies" marked `structural = true` | 1. New Part. 2. Set Category = "Assemblies" (structural). 3. Save. | Save is blocked, or the structural category is not selectable in the picker; error explains parts must go in a leaf sub-category. | P2 | Negative |
| CAT-08 | Category default location applied to new part | Category "Electronics" has Default Location = "Bin A1" | 1. New Part with Category = "Electronics", leave Default Location blank. 2. Save. | Part's default location is inherited/pre-filled as "Bin A1" on the detail page. | P3 | Positive |
| CAT-09 | Deleting a category with parts requires confirmation/reassignment | Category has 3 parts assigned | 1. Categories → select category → Delete. | System either blocks deletion or prompts to reassign/orphan the contained parts before proceeding; parts are not silently deleted. | P1 | Negative |
| CAT-10 | Category cycle prevention | Categories A (parent) and B (child of A) exist | 1. Edit category A. 2. Set Parent = B (its own child). 3. Save. | Save blocked; error indicates a category cannot be its own descendant. | P2 | Negative |

## 5. Part Attributes

| ID | Title | Preconditions | Steps | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| ATTR-01 | Virtual part has no physical stock actions | Part has `virtual = true` | 1. Open part detail → Stock tab. | Stock tab either hidden or shows no "add physical stock" affordance appropriate to intangible items. | P2 | Positive |
| ATTR-02 | Template attribute enables Variants tab | Toggle `is_template = true` on an existing part | 1. Edit part → enable Template. 2. Save. 3. Reopen detail page. | Variants tab now appears; "New Variant" action available. | P1 | Positive |
| ATTR-03 | Assembly attribute enables BOM tab | Toggle `assembly = true` | 1. Edit part → enable Assembly. 2. Save. | BOM tab appears on the part detail page. | P1 | Positive |
| ATTR-04 | Component attribute allows part to be added to another's BOM | Part has `component = true` | 1. Open an assembly part's BOM tab → Add Line. 2. Search for this component part. | Part is selectable in the BOM line component picker. | P2 | Positive |
| ATTR-05 | Non-component part not selectable in BOM picker | Part has `component = false` | 1. Assembly part's BOM tab → Add Line → search for the non-component part. | Part does not appear in the picker results (or is shown disabled). | P2 | Negative |
| ATTR-06 | Trackable attribute enables serial/batch entry | Part has `trackable = true` | 1. Stock tab → New Stock Item. | Form includes serial number / batch code fields. | P2 | Positive |
| ATTR-07 | Purchaseable attribute enables supplier linkage | Part has `purchaseable = true` | 1. Open part detail. | Suppliers/Purchase Orders tab is visible; "New Supplier Part" action available. | P2 | Positive |
| ATTR-08 | Non-purchaseable part hides purchasing actions | Part has `purchaseable = false` | 1. Open part detail. | Suppliers/Purchase Orders tab hidden or read-only with no add action. | P3 | Negative |
| ATTR-09 | Salable attribute enables sales order allocation | Part has `salable = true` | 1. Create a Sales Order line. 2. Search for this part. | Part is selectable as a sales order line item. | P2 | Positive |
| ATTR-10 | Inactive part cannot be added to a new BOM | Part has `active = false` | 1. Assembly part's BOM tab → Add Line → search for the inactive part. | Inactive part does not appear in the picker (or appears clearly marked inactive and is blocked from selection). | P1 | Negative |
| ATTR-11 | Inactive part cannot be added to a new Purchase/Sales Order | Part has `active = false`, `purchaseable/salable = true` | 1. Create a new PO/SO line. 2. Search for the inactive part. | Part is excluded from the selectable results for new order lines. | P1 | Negative |
| ATTR-12 | Deactivating a part does not remove existing stock/orders | Active part has existing stock and an open BOM reference | 1. Edit part → set Active = false. 2. Save. | Part becomes inactive; existing stock items, BOM references, and orders remain intact and visible. | P2 | Positive |

## 6. Units of Measure Configuration

| ID | Title | Preconditions | Steps | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| UOM-01 | Assign a standard physical unit to a part | — | 1. Edit part → Units = "kg". 2. Save. | Unit persisted and displayed as "kg" throughout stock/quantity fields for this part. | P1 | Positive |
| UOM-02 | Engineering notation accepted for quantity entry | Part units = "ohm" | 1. Add Parameter/stock quantity value "10k3". | Value is interpreted/normalised as 10300; displayed consistently. | P2 | Positive |
| UOM-03 | Unit case sensitivity enforced | — | 1. Edit part → Units = "KG" (uppercase). 2. Save. | Save blocked or normalised — verify actual behaviour; "KG" must not silently be treated identically to a different unit "Kg" without normalisation. Record observed behaviour. | P3 | Boundary |
| UOM-04 | Create a custom dimensionless unit | Settings → Physical Units | 1. Add custom unit "reel", definition = "1". 2. Save. 3. Assign "reel" as a part's Units. | Custom unit is created, selectable, and assignable to parts; quantity fields show "reel" as the unit label. | P2 | Positive |
| UOM-05 | Incompatible unit conversion rejected at supplier pack quantity | Part units = "m" (length); supplier pack defines pack quantity in "kg" | 1. Add/edit a Supplier Part with a pack-quantity unit of "kg" for this length-based part. 2. Save. | Save blocked; error indicates incompatible unit dimension (mass vs length). | P2 | Negative |
| UOM-06 | Imperial shorthand accepted | Part units = "m" | 1. Enter a quantity value using imperial shorthand, e.g. `3'` (3 feet). | Value accepted and converted/normalised to the part's base unit for storage/display. | P3 | Boundary |

## 7. Part Revisions

| ID | Title | Preconditions | Steps | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| REV-01 | Create a revision of a non-template part | Part "Widget" (not a template) exists | 1. Part actions (⋮) → Duplicate Part. 2. Revision Of = "Widget". 3. Revision = "B". 4. Save. | New part created, linked as revision "B" of "Widget"; revision switcher appears on both parts' detail pages. | P1 | Positive |
| REV-02 | Duplicate revision code rejected | "Widget" already has a revision "B" | 1. Duplicate Part → Revision Of = "Widget". 2. Revision = "B" again. 3. Save. | Save blocked; error indicates this revision code already exists for that part. | P1 | Negative |
| REV-03 | Part cannot be a revision of itself | Part "Widget" exists | 1. Edit "Widget" → set Revision Of = "Widget" (itself). 2. Save. | Save blocked; error indicates a part cannot be its own revision (circular reference). | P1 | Negative |
| REV-04 | Template part cannot have revisions | Part "Base Harness" has `is_template = true` | 1. Duplicate Part → Revision Of = "Base Harness". 2. Revision = "A". 3. Save. | Save blocked; error indicates template parts cannot be revisioned. | P1 | Negative |
| REV-05 | Revision-of-revision prevented | "Widget" Rev B exists (itself a revision of "Widget") | 1. Duplicate Part → Revision Of = "Widget Rev B". 2. Revision = "C". 3. Save. | Save blocked, or system redirects the relationship to the root part rather than chaining — verify and record actual behaviour; chained revisions of revisions must not be permitted per requirements. | P1 | Negative |
| REV-06 | Variant revision must align to same template | Variant part "Widget - Red" (variant of template "Widget Template") | 1. Duplicate Part → Revision Of = "Widget - Red". 2. Leave/point template link as-is. 3. Save. | New revision is created and still references "Widget Template" as its template; template linkage is not lost or changed. | P2 | Positive |
| REV-07 | Revision does not affect original part's stock | "Widget" has 10 units of existing stock | 1. Create Revision "B" of "Widget" per REV-01. 2. Return to "Widget" (original/Rev A). | Original part's stock count (10 units) is unchanged; new revision starts with zero stock of its own. | P2 | Positive |
| REV-08 | Revision does not affect original part's BOM/orders | "Widget" is an assembly with an existing BOM and an open build order | 1. Create Revision "B" of "Widget". 2. Return to "Widget". | Original BOM lines and build order remain intact and unaffected on the original part. | P2 | Positive |
| REV-09 | Revision switcher navigates between all sibling revisions | "Widget" has Rev A (original), Rev B, Rev C | 1. Open Rev A. 2. Use revision switcher to select Rev C. | Page navigates to Rev C's detail view; switcher lists A, B, and C. | P2 | Positive |
| REV-10 | Revision field optional on plain part creation | — | 1. New Part → Name only, no Revision Of set. 2. Save. | Part created successfully with no revision relationship; no revision switcher shown. | P3 | Positive |

## 8. Cross-Cutting Negative & Boundary Scenarios

| ID | Title | Preconditions | Steps | Expected Result | Priority | Type |
|---|---|---|---|---|---|---|
| NEG-01 | Deleting an active part is blocked outright (regardless of references) | Part is `active = true` | 1. Part actions (⋮) → Delete. | **Verified against a live instance**: the Delete menu item is disabled while the part is active, and the API rejects the delete with "Cannot delete this part as it is still active" — this applies even to a part with no stock/BOM/order references at all. Deactivate via Edit first before Delete becomes available. | P1 | Negative |
| NEG-01b | Deactivated part with only stock references can be deleted | Part is `active = false`, has stock items but no BOM references | 1. Part actions → Delete → confirm. | **Verified against a live instance**: deletion succeeds — a stock reference alone does not block deletion once the part is inactive. Do not assume this is blocked by analogy with NEG-02. | P2 | Positive |
| NEG-02 | Deleting a part referenced by an active BOM is blocked | Part is used as a BOM line in another assembly, deactivated first | 1. Part actions → Delete. | Deletion blocked; error names the referencing assembly/BOM. **Verified against a live instance**: this block holds even after deactivation — a BOM reference is a stronger constraint than the active flag. | P1 | Negative |
| NEG-03 | Locked part cannot be edited | Part has `locked = true` | 1. Attempt to edit any field on the part. 2. Save. | Edit is blocked or fields are read-only; UI communicates the part is locked. | P2 | Negative |
| NEG-04 | Empty search/filter returns full unfiltered list | Parts list view | 1. Enter and then clear the search box. | List reverts to showing all parts (respecting existing non-search filters). | P3 | Boundary |
| NEG-05 | Minimum stock cannot be negative | — | 1. Edit part → Minimum Stock = -5. 2. Save. | Save blocked; validation error indicates the value must be ≥ 0. | P2 | Boundary |
| NEG-06 | Very long description is handled gracefully | — | 1. New Part → Description = 251+ characters (limit 250). 2. Save. | Save blocked or input truncated at the limit — record actual behaviour; no server error/crash. | P3 | Boundary |
| NEG-07 | Concurrent edit conflict is surfaced to the user | Same part open for edit in two browser sessions | 1. Session A edits and saves Name. 2. Session B (stale form) edits a different field and saves. | Session B is warned of a conflicting/stale update rather than silently overwriting Session A's change, or last-write-wins is clearly the documented behaviour — record actual behaviour observed. | P3 | Negative |

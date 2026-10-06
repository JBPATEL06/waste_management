# Waste Journey Tracking Portal — Activity Diagrams (All Panels)

Version: Draft 1 (pre-PRD) | Format: Mermaid (GitHub / VS Code Mermaid preview / mermaid.live)

---

## 0. Locked Decisions (inputs to these diagrams)

| Area | Decision |
|---|---|
| Roles | Admin, Collection, Transportation, RTS, Processing, Head Officer (+ Public tracking, no login) |
| Stage order | Strict: Collection → Transportation → RTS → Processing. Next stage locked until previous has a valid entry |
| Status | Derived automatically from latest valid stage entry |
| Corrections | Stage user: cannot edit/delete; submits a corrected entry (old one stays in history as superseded). Admin: can edit and delete (soft delete, reason mandatory, logged in history) |
| Master data | Admin manages Routes, Vehicles, RTS Locations, Processing Facilities, Process Types, Waste Categories, Drivers/Supervisors |
| Assignment | Admin assigns one user per stage at batch creation; stage user sees only assigned batches |
| Export | CSV and Excel (multi-sheet) |
| Public tracking | QR / Batch ID opens a public read-only page, no login |

### Stage fields

| Stage | Fields |
|---|---|
| Batch (Admin) | Batch ID (auto), date, waste type (Wet/Dry), quantity, source/area, route*, vehicle*, initial status, system datetime, assigned users (4 stages) |
| Collection | collection area/location, route*, vehicle*, waste type, quantity, collection date, exact time, driver/supervisor*, note |
| Transportation | start location, destination, RTS/next location*, vehicle*, departure datetime, arrival datetime (optional at first), journey duration (auto), note |
| RTS | RTS name*, RTS location (auto), arrival date, arrival time, quantity received, waste category*, handover/receiving details, next process/destination*, note |
| Processing | facility*, process type* (Composting / Recovery / Electricity generation / Disposal), arrival date, arrival time, quantity, final status (Processed / Recovered / Disposed / Completed), note |

`*` = dropdown from Master Data

---

## 1. Common — Login & Role Redirect

```mermaid
flowchart TD
    A(["Start"]) --> B["Open Login Page"]
    B --> C["Enter email + password"]
    C --> D{"Credentials valid?"}
    D -- "No" --> E["Show error message"]
    E --> C
    D -- "Yes" --> F{"Account active?"}
    F -- "No" --> G["Show: account disabled, contact Admin"]
    G --> B
    F -- "Yes" --> H["Issue JWT with role"]
    H --> I{"Role?"}
    I -- "Admin" --> J["Admin Dashboard"]
    I -- "Collection" --> K["Collection Dashboard"]
    I -- "Transportation" --> L["Transportation Dashboard"]
    I -- "RTS" --> M["RTS Dashboard"]
    I -- "Processing" --> N["Processing Dashboard"]
    I -- "Head Officer" --> O["Head Officer Dashboard"]
    J --> P(["Logout / Session expiry"])
    K --> P
    L --> P
    M --> P
    N --> P
    O --> P
    P --> B
```

---

## 2. Admin Panel

### 2.1 Admin — Overview

```mermaid
flowchart TD
    A(["Admin logged in"]) --> B["Admin Dashboard"]
    B --> C{"Choose module"}
    C --> D["Master Data Management"]
    C --> E["User Management"]
    C --> F["Create Batch + Assign + QR"]
    C --> G["Batch Management"]
    C --> H["Dashboard Analytics"]
    C --> I["Export Data"]
    D --> B
    E --> B
    F --> B
    G --> B
    H --> B
    I --> B
```

### 2.2 Admin — Master Data Management

```mermaid
flowchart TD
    A(["Open Master Data"]) --> B{"Select master"}
    B --> B1["Routes"]
    B --> B2["Vehicles"]
    B --> B3["RTS Locations"]
    B --> B4["Processing Facilities"]
    B --> B5["Process Types"]
    B --> B6["Waste Categories"]
    B --> B7["Drivers / Supervisors"]
    B1 --> C["Show list with search + status filter"]
    B2 --> C
    B3 --> C
    B4 --> C
    B5 --> C
    B6 --> C
    B7 --> C
    C --> D{"Action?"}
    D -- "Add" --> E["Fill form"]
    D -- "Edit" --> F["Select record, change values"]
    D -- "Deactivate" --> G{"Used in any batch?"}
    E --> H{"Valid and not duplicate?"}
    F --> H
    H -- "No" --> I["Show validation error"]
    I --> D
    H -- "Yes" --> J["Save record"]
    G -- "Yes" --> K["Soft deactivate: hidden from dropdowns, kept in old records"]
    G -- "No" --> L["Deactivate or delete record"]
    J --> M(["Master updated, available in dropdowns"])
    K --> M
    L --> M
```

### 2.3 Admin — User Management

```mermaid
flowchart TD
    A(["Open User Management"]) --> B["List users with role + status filter"]
    B --> C{"Action?"}
    C -- "Add user" --> D["Enter name, email, role, temp password"]
    C -- "Edit user" --> E["Change name / role / email"]
    C -- "Reset password" --> F["Set new temp password"]
    C -- "Activate / Deactivate" --> G{"Deactivating?"}
    D --> H{"Email unique and valid?"}
    H -- "No" --> I["Show error"]
    I --> D
    H -- "Yes" --> J["Create user"]
    E --> K["Save changes"]
    F --> K
    G -- "No" --> K
    G -- "Yes" --> L{"User has pending assigned batches?"}
    L -- "Yes" --> M["Prompt: reassign pending batches to another user of same role"]
    M --> N["Reassign and log in history"]
    N --> K
    L -- "No" --> K
    J --> O(["Done"])
    K --> O
```

### 2.4 Admin — Create Batch + Assign Stage Users + Generate QR

```mermaid
flowchart TD
    A(["Click Create Batch"]) --> B["Fill batch form: date, waste type, quantity, source/area"]
    B --> C["Select route + vehicle from master"]
    C --> D["Set initial status"]
    D --> E["Assign users: Collection, Transportation, RTS, Processing"]
    E --> F{"All fields valid and 4 users assigned?"}
    F -- "No" --> G["Highlight missing / invalid fields"]
    G --> B
    F -- "Yes" --> H["System generates unique Batch ID + system datetime"]
    H --> I["Save batch, status = Created"]
    I --> J["Generate QR linking to public tracking URL"]
    J --> K["Show Batch ID + QR"]
    K --> L{"Download / Print QR?"}
    L -- "Yes" --> M["Download PNG / Print"]
    L -- "No" --> N(["Batch visible to Collection user"])
    M --> N
```

### 2.5 Admin — Batch Management (View, Reassign, Edit, Delete)

```mermaid
flowchart TD
    A(["Open Batch Management"]) --> B["Search by Batch ID / filter by status, date, route, vehicle, waste type"]
    B --> C["Open batch"]
    C --> D["View details + timeline + full history including superseded and deleted entries"]
    D --> E{"Action?"}
    E -- "Reassign stage user" --> F["Select stage + new user of that role"]
    F --> G["Save, log in history"]
    E -- "Edit stage entry" --> H["Select entry, change fields"]
    H --> I["Enter reason - mandatory"]
    I --> J{"Passes validation? date order, qty, master values"}
    J -- "No" --> K["Show error"]
    K --> H
    J -- "Yes" --> L["Save, store old + new values, admin, time in history"]
    E -- "Delete stage entry" --> M["Select entry"]
    M --> N{"Later stage entries exist?"}
    N -- "Yes" --> O["Block: delete later stage entries first"]
    N -- "No" --> P["Enter reason - mandatory"]
    P --> Q["Soft delete, keep in history as deleted"]
    E -- "Edit batch details" --> H
    E -- "Download QR" --> R["Download QR PNG"]
    G --> S["Re-derive batch status from latest valid entry"]
    L --> S
    Q --> S
    O --> D
    S --> T(["Updated timeline shown"])
    R --> T
```

### 2.6 Admin — Dashboard (Detailed)

```mermaid
flowchart TD
    A(["Open Dashboard"]) --> B["Apply filters: date range, waste type, route, vehicle, RTS, facility, status"]
    B --> C["Load KPI cards: total batches, Created, Collected, In Transit, At RTS, Completed"]
    C --> D["Load quantity view: collected vs received at RTS vs processed, variance"]
    D --> E["Load breakdowns: waste type, route-wise, vehicle-wise, RTS-wise, process type-wise, final status"]
    E --> F["Load operational: avg journey duration, delayed batches, pending per stage per user"]
    F --> G["Load recent updates + recent corrections / deletions"]
    G --> H{"Click a card / row?"}
    H -- "Yes" --> I["Open filtered batch list"]
    H -- "No" --> J(["Stay on dashboard"])
    I --> J
```

### 2.7 Admin — Export (CSV / Excel)

```mermaid
flowchart TD
    A(["Open Export"]) --> B{"Select dataset"}
    B --> B1["Batches"]
    B --> B2["Stage-wise records"]
    B --> B3["Full tracking history incl. corrections"]
    B --> B4["Current batch status"]
    B1 --> C["Apply filters: date, status, route, vehicle, waste type"]
    B2 --> C
    B3 --> C
    B4 --> C
    C --> D{"Format?"}
    D -- "CSV" --> E["Generate CSV"]
    D -- "Excel" --> F["Generate XLSX, one sheet per dataset"]
    E --> G{"Any records?"}
    F --> G
    G -- "No" --> H["Show: no records for filters"]
    H --> C
    G -- "Yes" --> I(["Download file"])
```

---

## 3. Collection Panel

```mermaid
flowchart TD
    A(["Collection user logged in"]) --> B["Dashboard: assigned batches, tabs Pending / Submitted"]
    B --> C{"Select action"}
    C -- "Pending batch" --> D["Open batch"]
    C -- "Submitted batch" --> S["Open batch, view own entry"]
    D --> E["Fill form: area/location, route, vehicle, waste type, quantity, date, exact time, driver/supervisor, note"]
    E --> F{"Valid? required fields, master values, qty > 0"}
    F -- "No" --> G["Show errors"]
    G --> E
    F -- "Yes" --> H["Save entry with user + timestamp"]
    H --> I["Batch status = Collected"]
    I --> J["Transportation user can now see batch"]
    J --> K(["End"])
    S --> T{"Need correction?"}
    T -- "No" --> K
    T -- "Yes" --> U["Click Submit Correction - edit/delete buttons not available"]
    U --> V["Fill corrected values + reason"]
    V --> W{"Valid?"}
    W -- "No" --> V
    W -- "Yes" --> X["Save as new entry, old entry marked superseded, kept in history"]
    X --> K
```

Permissions: add/correct Collection stage only on assigned batches. View-only for other stages. No edit/delete.

---

## 4. Transportation Panel

```mermaid
flowchart TD
    A(["Transportation user logged in"]) --> B["Dashboard: assigned batches with Locked / Ready / In Transit / Submitted"]
    B --> C["Open batch"]
    C --> D{"Collection entry exists?"}
    D -- "No" --> E["Show: waiting for Collection, form locked"]
    E --> K(["End"])
    D -- "Yes" --> F["Show form: start location prefilled, destination, RTS/next location, vehicle, departure datetime, arrival datetime optional, note"]
    F --> G{"Valid? departure after collection time, arrival after departure"}
    G -- "No" --> H["Show errors"]
    H --> F
    G -- "Yes" --> I{"Arrival entered?"}
    I -- "Yes" --> J["Auto-calculate journey duration"]
    I -- "No" --> L["Duration pending"]
    J --> M["Save entry"]
    L --> M
    M --> N["Batch status = In Transit"]
    N --> O{"Arrival missing?"}
    O -- "Yes" --> P["Later: Submit Correction with arrival time, duration calculated"]
    O -- "No" --> Q["RTS user can now see batch"]
    P --> Q
    Q --> K
```

Permissions: add/correct Transportation stage only. Needs Collection entry. RTS unlocks only after arrival time is recorded.

---

## 5. RTS / Transfer Panel

```mermaid
flowchart TD
    A(["RTS user logged in"]) --> B["Dashboard: assigned batches Locked / Ready / Submitted"]
    B --> C["Open batch"]
    C --> D{"Transportation entry with arrival exists?"}
    D -- "No" --> E["Show: waiting for Transportation arrival, form locked"]
    E --> K(["End"])
    D -- "Yes" --> F["Show form: RTS name, location auto, arrival date + time, qty received, waste category, handover/receiving details, next process/destination, note"]
    F --> G{"Valid? arrival not before transport arrival, qty > 0"}
    G -- "No" --> H["Show errors"]
    H --> F
    G -- "Yes" --> I{"Qty received differs from collected beyond threshold?"}
    I -- "Yes" --> J["Flag variance for Admin / Head Officer view"]
    I -- "No" --> L["Save entry"]
    J --> L
    L --> M["Batch status = At RTS"]
    M --> N["Processing user can now see batch"]
    N --> O{"Correction needed?"}
    O -- "Yes" --> P["Submit Correction + reason, old entry superseded"]
    O -- "No" --> K
    P --> K
```

Permissions: add/correct RTS stage only. View-only for other stages.

---

## 6. Processing Panel

```mermaid
flowchart TD
    A(["Processing user logged in"]) --> B["Dashboard: assigned batches Locked / Ready / Completed"]
    B --> C["Open batch"]
    C --> D{"RTS entry exists?"}
    D -- "No" --> E["Show: waiting for RTS, form locked"]
    E --> K(["End"])
    D -- "Yes" --> F["View previous stages read-only"]
    F --> G["Show form: facility, process type, arrival date + time, quantity, final status, note"]
    G --> H{"Valid? arrival not before RTS arrival, qty > 0, final status selected"}
    H -- "No" --> I["Show errors"]
    I --> G
    H -- "Yes" --> J["Save entry"]
    J --> L["Batch status = Completed, journey closed"]
    L --> M["Visible to Head Officer + Public as Completed"]
    M --> N{"Correction needed?"}
    N -- "Yes" --> O["Submit Correction + reason, old entry superseded"]
    N -- "No" --> K
    O --> K
```

Permissions: add/correct Processing stage only. Cannot edit Collection, Transportation or RTS entries. After completion only Admin can edit/delete.

---

## 7. Head Officer Panel (View-Only)

```mermaid
flowchart TD
    A(["Head Officer logged in"]) --> B["View-only Dashboard: KPI cards, stage breakdown, recent updates, flagged variances"]
    B --> C{"Action?"}
    C -- "Filter batch list" --> D["Filter by date, status, route, vehicle, waste type"]
    C -- "Search Batch ID" --> E["Enter Batch ID"]
    C -- "Export" --> J["Select dataset + CSV / Excel, download"]
    D --> F["Batch list"]
    E --> G{"Batch found?"}
    G -- "No" --> H["Show not found"]
    H --> C
    G -- "Yes" --> I["Open batch"]
    F --> I
    I --> K["View details, full timeline, correction history"]
    K --> L(["End - no add / edit / delete controls shown"])
    J --> L
```

Permissions: read-only everywhere. Export allowed (read-only operation).

---

## 8. Public Tracking (No Login)

```mermaid
flowchart TD
    A(["Start"]) --> B{"Entry point"}
    B -- "Scan QR" --> C["Open /track/BatchID"]
    B -- "Public search box" --> D["Enter Batch ID"]
    D --> C
    C --> E{"Batch exists?"}
    E -- "No" --> F["Show: batch not found"]
    F --> D
    E -- "Yes" --> G["Show batch details: Batch ID, waste type, quantity, source, current status"]
    G --> H["Show timeline: Collection, Transportation, RTS, Processing with date/time, location, status"]
    H --> I(["End"])
```

Public view hides: driver names, user names, vehicle numbers, correction/deleted history, internal notes.

---

## 9. End-to-End Swimlane

```mermaid
flowchart TD
    subgraph ADM["Admin"]
        A1["Setup master data + users"] --> A2["Create batch, assign 4 users"]
        A2 --> A3["Batch ID + QR generated"]
    end
    subgraph COL["Collection"]
        C1["Add collection entry"]
    end
    subgraph TRN["Transportation"]
        T1["Add departure + arrival"]
    end
    subgraph RTS["RTS"]
        R1["Add receipt + handover"]
    end
    subgraph PRC["Processing"]
        P1["Add process + final status"]
    end
    subgraph HO["Head Officer"]
        H1["View dashboard + journey"]
    end
    subgraph PUB["Public"]
        U1["Scan QR, view timeline"]
    end
    subgraph ADM2["Admin"]
        A4["Correct if needed, export CSV / Excel"]
    end
    A3 --> C1
    C1 -->|"Status: Collected"| T1
    T1 -->|"Status: In Transit"| R1
    R1 -->|"Status: At RTS"| P1
    P1 -->|"Status: Completed"| H1
    P1 --> U1
    H1 --> A4
```

---

## 10. Batch Status Derivation

```mermaid
stateDiagram-v2
    [*] --> Created: Admin creates batch
    Created --> Collected: Valid Collection entry
    Collected --> InTransit: Valid Transportation entry
    InTransit --> AtRTS: Valid RTS entry
    AtRTS --> Completed: Valid Processing entry
    Completed --> AtRTS: Admin deletes Processing entry
    AtRTS --> InTransit: Admin deletes RTS entry
    InTransit --> Collected: Admin deletes Transportation entry
    Collected --> Created: Admin deletes Collection entry
    Completed --> [*]
```

Rule: status = stage of the latest valid (not superseded, not deleted) entry. Admin deletion must go in reverse order (latest stage first).

---

## 11. Permission Matrix

| Action | Admin | Collection | Transportation | RTS | Processing | Head Officer | Public |
|---|---|---|---|---|---|---|---|
| Manage master data | Yes | No | No | No | No | No | No |
| Manage users | Yes | No | No | No | No | No | No |
| Create batch / assign users | Yes | No | No | No | No | No | No |
| Add own-stage entry | Yes | Collection | Transportation | RTS | Processing | No | No |
| Submit correction (own stage) | Yes | Yes | Yes | Yes | Yes | No | No |
| Edit / delete any entry | Yes (reason + history) | No | No | No | No | No | No |
| View assigned batches | All | Assigned | Assigned | Assigned | Assigned | All | By ID only |
| Full history + corrections | Yes | Own stage | Own stage | Own stage | Own stage | Yes | No |
| Dashboard | Detailed | Own queue | Own queue | Own queue | Own queue | Detailed read-only | No |
| Export CSV / Excel | Yes | No | No | No | No | Yes | No |
| Public tracking view | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

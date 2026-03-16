# Matrix Manager Schema Diagrams

Mermaid ER diagrams:

- `docs/control-db-schema.mmd` — control DB
- `docs/data-db-schema.mmd` — primary app/data DB

Notes:
- The control DB and primary data DB are intentionally separate.
- `UserAccount.employee_id` is a logical cross-DB link to `Employee.id`.
- Assignment username fields are logical links back to control DB users, not physical foreign keys.

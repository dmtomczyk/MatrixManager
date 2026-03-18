# Matrix Manager Schema Diagrams

Mermaid diagrams:

- `docs/control-db-schema.mmd` — control DB ERD
- `docs/data-db-schema.mmd` — primary app/data DB ERD
- `docs/combined-db-architecture.md` — combined two-DB architecture + logical cross-links

Notes:
- The control DB and primary data DB are intentionally separate.
- `UserAccount.employee_id` is a logical cross-DB link to `Employee.id`.
- Assignment username fields are logical links back to control DB users, not physical foreign keys.

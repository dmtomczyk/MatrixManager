from __future__ import annotations

from pathlib import Path
import sys

from sqlmodel import SQLModel

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import DB_PATH, create_db_and_tables, engine, run_migrations


def main() -> None:
    if Path(DB_PATH).exists():
        Path(DB_PATH).unlink()
        print(f"Deleted {DB_PATH}")
    SQLModel.metadata.create_all(engine)
    create_db_and_tables()
    run_migrations()
    print(f"Initialized fresh database at {DB_PATH}")


if __name__ == "__main__":
    main()

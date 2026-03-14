from __future__ import annotations

from datetime import date
from pathlib import Path
import sys

from sqlmodel import Session, select

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import (
    Assignment,
    DB_PATH,
    Employee,
    Organization,
    Project,
    create_db_and_tables,
    engine,
    run_migrations,
)


def reset_database() -> None:
    if Path(DB_PATH).exists():
        Path(DB_PATH).unlink()
    create_db_and_tables()
    run_migrations()


def main() -> None:
    reset_database()
    with Session(engine) as session:
        eng = Organization(name="Engineering", description="Product engineering")
        prod = Organization(name="Product", description="Product and design")
        ops = Organization(name="Operations", description="Business operations")
        session.add_all([eng, prod, ops])
        session.commit()
        session.refresh(eng)
        session.refresh(prod)
        session.refresh(ops)

        ceo = Employee(name="Alex CEO", employee_type="L", organization_id=ops.id, capacity=1.0)
        eng_dir = Employee(name="Blair Eng Director", employee_type="L", organization_id=eng.id, manager_id=None, capacity=1.0)
        prod_dir = Employee(name="Casey Product Director", employee_type="L", organization_id=prod.id, manager_id=None, capacity=1.0)
        session.add_all([ceo, eng_dir, prod_dir])
        session.commit()
        session.refresh(ceo)
        session.refresh(eng_dir)
        session.refresh(prod_dir)

        eng_dir.manager_id = ceo.id
        prod_dir.manager_id = ceo.id
        session.add_all([eng_dir, prod_dir])
        session.commit()

        eng_mgr = Employee(name="Devon Engineering Manager", employee_type="L", organization_id=eng.id, manager_id=eng_dir.id, capacity=1.0)
        prod_mgr = Employee(name="Emery Product Manager", employee_type="L", organization_id=prod.id, manager_id=prod_dir.id, capacity=1.0)
        eng_ic_1 = Employee(name="Fin Backend Engineer", employee_type="IC", organization_id=eng.id, manager_id=eng_mgr.id, role="Backend Engineer", location="Remote", capacity=1.0)
        eng_ic_2 = Employee(name="Gray Frontend Engineer", employee_type="IC", organization_id=eng.id, manager_id=eng_mgr.id, role="Frontend Engineer", location="NYC", capacity=1.0)
        prod_ic = Employee(name="Harper Product Designer", employee_type="IC", organization_id=prod.id, manager_id=prod_mgr.id, role="Designer", location="Remote", capacity=0.8)
        session.add_all([eng_mgr, prod_mgr, eng_ic_1, eng_ic_2, prod_ic])
        session.commit()
        for item in [eng_mgr, prod_mgr, eng_ic_1, eng_ic_2, prod_ic]:
            session.refresh(item)

        proj_a = Project(name="Phoenix Platform", description="Platform modernization", start_date=date(2026, 3, 1), end_date=date(2026, 6, 30))
        proj_b = Project(name="Atlas Launch", description="New product launch", start_date=date(2026, 3, 15), end_date=date(2026, 5, 15))
        proj_c = Project(name="Ops Dashboard", description="Internal tooling refresh", start_date=date(2026, 4, 1), end_date=date(2026, 7, 1))
        session.add_all([proj_a, proj_b, proj_c])
        session.commit()
        for item in [proj_a, proj_b, proj_c]:
            session.refresh(item)

        assignments = [
            Assignment(employee_id=eng_ic_1.id, project_id=proj_a.id, start_date=date(2026, 3, 1), end_date=date(2026, 4, 15), allocation=0.75, notes="Core backend work"),
            Assignment(employee_id=eng_ic_2.id, project_id=proj_a.id, start_date=date(2026, 3, 1), end_date=date(2026, 4, 30), allocation=0.5, notes="Frontend migration"),
            Assignment(employee_id=eng_ic_2.id, project_id=proj_b.id, start_date=date(2026, 3, 15), end_date=date(2026, 5, 1), allocation=0.5, notes="Launch UI"),
            Assignment(employee_id=prod_ic.id, project_id=proj_b.id, start_date=date(2026, 3, 15), end_date=date(2026, 5, 15), allocation=0.8, notes="Design support"),
            Assignment(employee_id=eng_mgr.id, project_id=proj_c.id, start_date=date(2026, 4, 1), end_date=date(2026, 6, 1), allocation=0.25, notes="Technical oversight"),
        ]
        session.add_all(assignments)
        session.commit()

        org_count = len(session.exec(select(Organization)).all())
        employee_count = len(session.exec(select(Employee)).all())
        project_count = len(session.exec(select(Project)).all())
        assignment_count = len(session.exec(select(Assignment)).all())
        print(
            f"Seeded sample data into {DB_PATH}: "
            f"{org_count} organizations, {employee_count} employees, {project_count} projects, {assignment_count} assignments"
        )


if __name__ == "__main__":
    main()

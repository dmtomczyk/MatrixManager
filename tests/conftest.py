from __future__ import annotations

from pathlib import Path
from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from app import main as mainmod

AUTH = ("testuser", "testpass")


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    db_path = tmp_path / "test_matrix.db"
    test_engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )

    original_engine = mainmod.engine
    original_db_path = mainmod.DB_PATH

    monkeypatch.setenv("MATRIX_AUTH_USERNAME", AUTH[0])
    monkeypatch.setenv("MATRIX_AUTH_PASSWORD", AUTH[1])

    mainmod.engine = test_engine
    mainmod.DB_PATH = db_path
    SQLModel.metadata.create_all(mainmod.engine)
    mainmod.run_migrations()

    with TestClient(mainmod.app) as test_client:
        login_response = test_client.post(
            "/login",
            content=f"username={AUTH[0]}&password={AUTH[1]}&next=%2F",
            headers={"content-type": "application/x-www-form-urlencoded"},
            follow_redirects=False,
        )
        assert login_response.status_code == 302, login_response.text
        yield test_client

    mainmod.engine = original_engine
    mainmod.DB_PATH = original_db_path


@pytest.fixture()
def session() -> Iterator[Session]:
    with Session(mainmod.engine) as db_session:
        yield db_session


def create_organization(client: TestClient, name: str = "Engineering", description: str | None = None) -> dict:
    response = client.post("/organizations", json={"name": name, "description": description})
    assert response.status_code == 201, response.text
    return response.json()


def create_job_code(client: TestClient, name: str, is_leader: bool = False) -> dict:
    response = client.post("/job-codes-api", json={"name": name, "is_leader": is_leader})
    assert response.status_code == 201, response.text
    return response.json()


def create_employee(
    client: TestClient,
    organization_id: int,
    name: str,
    employee_type: str = "L",
    manager_id: int | None = None,
    role: str | None = None,
    location: str | None = None,
    capacity: float = 1.0,
) -> dict:
    job_code = create_job_code(client, name=role or f"{name} {'Leader' if employee_type == 'L' else 'IC'}", is_leader=employee_type == 'L')
    payload = {
        "name": name,
        "job_code_id": job_code["id"],
        "organization_id": organization_id,
        "manager_id": manager_id,
        "location": location,
        "capacity": capacity,
    }
    response = client.post("/employees", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def create_project(
    client: TestClient,
    name: str = "Project Alpha",
    description: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    response = client.post(
        "/projects",
        json={
            "name": name,
            "description": description,
            "start_date": start_date,
            "end_date": end_date,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_demand(
    client: TestClient,
    project_id: int,
    title: str = "Backend SWE - C#",
    job_code_id: int | None = None,
    skill_notes: str | None = None,
    start_date: str = "2026-03-01",
    end_date: str = "2026-03-31",
    required_allocation: float = 1.0,
    notes: str | None = None,
) -> dict:
    response = client.post(
        "/demands-api",
        json={
            "project_id": project_id,
            "title": title,
            "job_code_id": job_code_id,
            "skill_notes": skill_notes,
            "start_date": start_date,
            "end_date": end_date,
            "required_allocation": required_allocation,
            "notes": notes,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_assignment(
    client: TestClient,
    employee_id: int,
    project_id: int,
    start_date: str = "2026-03-01",
    end_date: str = "2026-03-14",
    allocation: float = 0.5,
    notes: str | None = None,
    demand_id: int | None = None,
) -> dict:
    response = client.post(
        "/assignments",
        json={
            "employee_id": employee_id,
            "project_id": project_id,
            "demand_id": demand_id,
            "start_date": start_date,
            "end_date": end_date,
            "allocation": allocation,
            "notes": notes,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()

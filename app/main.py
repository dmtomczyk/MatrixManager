from __future__ import annotations

import base64
import csv
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import subprocess
import threading
import time
import traceback
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Generator, List, Optional, Set
from urllib.parse import quote, quote_plus

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Field, Session, SQLModel, create_engine, select
import fastapi
import sqlmodel

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
DB_PATH = Path(os.getenv("MATRIX_SQLITE_PATH", str(ROOT_DIR / "matrix.db"))).expanduser()
CONTROL_DB_PATH = Path(os.getenv("MATRIX_CONTROL_DB_PATH", str(ROOT_DIR / "matrixmanager_control.db"))).expanduser()
STATIC_DIR = BASE_DIR / "static"
SESSION_COOKIE_NAME = "matrixmanager_session"
MATRIX_INSTALL_MODE = os.getenv("MATRIX_INSTALL_MODE", "sqlite").strip().lower()
MATRIX_ACTIVE_DB_TYPE = os.getenv("MATRIX_ACTIVE_DB_TYPE", MATRIX_INSTALL_MODE).strip().lower()
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "matrixmanager")
POSTGRES_USER = os.getenv("POSTGRES_USER", "matrixmanager")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
POSTGRES_SSLMODE = os.getenv("POSTGRES_SSLMODE", "prefer")
MATRIXMANAGER_VERSION = os.getenv("MATRIXMANAGER_VERSION", "dev")

DATABASE_URL = f"sqlite:///{DB_PATH}"
CONTROL_DATABASE_URL = f"sqlite:///{CONTROL_DB_PATH}"
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
control_engine = create_engine(
    CONTROL_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
engine_cache: dict[str, Any] = {}
HEALTH_PROBE_INTERVAL_SECONDS = int(os.getenv("MATRIX_HEALTH_PROBE_INTERVAL_SECONDS", "60"))
health_probe_thread_started = False


class OrganizationBase(SQLModel):
    name: str
    description: Optional[str] = None
    parent_organization_id: Optional[int] = Field(default=None, foreign_key="organization.id")
    owner_employee_id: Optional[int] = Field(default=None, foreign_key="employee.id")


class Organization(OrganizationBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationRead(OrganizationBase):
    id: int
    parent_organization_name: Optional[str] = None
    owner_employee_name: Optional[str] = None
    child_organization_count: int = 0


class OrganizationUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_organization_id: Optional[int] = None
    owner_employee_id: Optional[int] = None


class JobCodeBase(SQLModel):
    name: str
    is_leader: bool = False


class JobCode(JobCodeBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class JobCodeCreate(JobCodeBase):
    pass


class JobCodeRead(JobCodeBase):
    id: int


class JobCodeUpdate(SQLModel):
    name: Optional[str] = None
    is_leader: Optional[bool] = None


class EmployeeBase(SQLModel):
    name: str
    job_code_id: Optional[int] = Field(default=None, foreign_key="jobcode.id")
    employee_type: str = "IC"
    location: Optional[str] = None
    capacity: float = 1.0
    manager_id: Optional[int] = None


class Employee(EmployeeBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id")
    manager_id: Optional[int] = Field(default=None, foreign_key="employee.id")


class EmployeeCreate(EmployeeBase):
    organization_id: int


class EmployeeRead(EmployeeBase):
    id: int
    organization_id: int
    organization_name: Optional[str] = None
    manager_name: Optional[str] = None
    direct_report_count: int = 0
    role: Optional[str] = None
    job_code_name: Optional[str] = None
    job_code_is_leader: bool = False


class EmployeeUpdate(SQLModel):
    name: Optional[str] = None
    job_code_id: Optional[int] = None
    location: Optional[str] = None
    capacity: Optional[float] = None
    organization_id: Optional[int] = None
    manager_id: Optional[int] = None


class ProjectBase(SQLModel):
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class Project(ProjectBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class ProjectCreate(ProjectBase):
    pass


class ProjectRead(ProjectBase):
    id: int


class ProjectUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class DemandBase(SQLModel):
    project_id: int = Field(foreign_key="project.id")
    title: str
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id")
    job_code_id: Optional[int] = Field(default=None, foreign_key="jobcode.id")
    skill_notes: Optional[str] = None
    start_date: date
    end_date: date
    required_allocation: float = 1.0
    notes: Optional[str] = None


class Demand(DemandBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class DemandCreate(DemandBase):
    pass


class DemandUpdate(SQLModel):
    project_id: Optional[int] = None
    title: Optional[str] = None
    organization_id: Optional[int] = None
    job_code_id: Optional[int] = None
    skill_notes: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    required_allocation: Optional[float] = None
    notes: Optional[str] = None


class DemandRead(SQLModel):
    id: int
    project_id: int
    project_name: Optional[str] = None
    title: str
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None
    job_code_id: Optional[int] = None
    job_code_name: Optional[str] = None
    skill_notes: Optional[str] = None
    start_date: date
    end_date: date
    required_allocation: float
    fulfilled_allocation: float = 0.0
    remaining_allocation: float = 0.0
    notes: Optional[str] = None


class AssignmentBase(SQLModel):
    employee_id: int = Field(foreign_key="employee.id")
    project_id: int = Field(foreign_key="project.id")
    demand_id: Optional[int] = Field(default=None, foreign_key="demand.id")
    start_date: date
    end_date: date
    allocation: float = 1.0
    notes: Optional[str] = None


class Assignment(AssignmentBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    status: str = "approved"
    submitted_by_username: Optional[str] = None
    approved_by_username: Optional[str] = None
    denied_by_username: Optional[str] = None
    reviewed_at: Optional[datetime] = None


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentUpdate(SQLModel):
    demand_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    allocation: Optional[float] = None
    notes: Optional[str] = None


class AssignmentRead(SQLModel):
    id: int
    employee_id: int
    project_id: int
    demand_id: Optional[int] = None
    start_date: date
    end_date: date
    allocation: float
    notes: Optional[str]
    employee_name: Optional[str]
    project_name: Optional[str]
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None
    demand_title: Optional[str] = None
    status: str = "approved"
    submitted_by_username: Optional[str] = None
    approved_by_username: Optional[str] = None
    denied_by_username: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    pending_approver_usernames: list[str] = []
    submitted_by_current_user: bool = False
    requires_current_user_approval: bool = False


class AuditEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    entity_type: str
    entity_id: Optional[int] = None
    entity_label: Optional[str] = None
    action: str
    actor_username: str
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    before_json: Optional[str] = None
    after_json: Optional[str] = None


class AuditEntryRead(SQLModel):
    id: int
    entity_type: str
    entity_id: Optional[int]
    entity_label: Optional[str]
    action: str
    actor_username: str
    occurred_at: datetime
    before_json: Optional[str]
    after_json: Optional[str]


class RuntimeErrorLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    path: Optional[str] = None
    method: Optional[str] = None
    username: Optional[str] = None
    error_type: str
    message: str
    traceback_text: Optional[str] = None


class RuntimeErrorLogRead(SQLModel):
    id: int
    occurred_at: datetime
    path: Optional[str] = None
    method: Optional[str] = None
    username: Optional[str] = None
    error_type: str
    message: str
    traceback_text: Optional[str] = None


class RuntimeServiceStatusRead(SQLModel):
    name: str
    state: str
    health: Optional[str] = None
    status_text: Optional[str] = None
    uptime: Optional[str] = None
    restart_count: Optional[int] = None
    image: Optional[str] = None


class RuntimeDbStatusRead(SQLModel):
    name: str
    db_type: str
    is_active: bool
    status: str
    detail: Optional[str] = None
    latency_ms: Optional[float] = None


class RuntimeHealthSnapshot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    overall_status: str
    control_db_status: str
    active_data_db_status: str
    docker_status: str
    error_count_last_hour: int = 0
    details_json: Optional[str] = None


class RuntimeHealthSnapshotRead(SQLModel):
    id: int
    occurred_at: datetime
    overall_status: str
    control_db_status: str
    active_data_db_status: str
    docker_status: str
    error_count_last_hour: int = 0
    details: Optional[dict[str, Any]] = None


class RuntimeErrorGroupRead(SQLModel):
    error_type: str
    message: str
    count: int
    last_seen_at: datetime
    sample_path: Optional[str] = None
    sample_username: Optional[str] = None


class RuntimeVersionRead(SQLModel):
    name: str
    version: str
    source: Optional[str] = None


class RuntimeOverviewRead(SQLModel):
    runtime_environment: str
    active_db_type: str
    install_mode: str
    docker_available: bool
    docker_error: Optional[str] = None
    overall_status: str = "unknown"
    checked_at: datetime
    control_db_status: str = "unknown"
    control_db_detail: Optional[str] = None
    active_data_db_status: str = "unknown"
    active_data_db_detail: Optional[str] = None
    recent_error_count: int = 0
    services: list[RuntimeServiceStatusRead] = []
    db_connections: list[RuntimeDbStatusRead] = []
    recommended_actions: list[str] = []
    installed_versions: list[RuntimeVersionRead] = []
    latest_snapshot: Optional[RuntimeHealthSnapshotRead] = None


class DBConnectionBase(SQLModel):
    name: str
    db_type: str
    sqlite_path: Optional[str] = None
    postgres_host: Optional[str] = None
    postgres_port: int = 5432
    postgres_database: Optional[str] = None
    postgres_username: Optional[str] = None
    postgres_password: Optional[str] = None
    postgres_sslmode: str = "prefer"


class DBConnectionConfig(DBConnectionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    is_active: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DBConnectionCreate(DBConnectionBase):
    pass


class DBConnectionUpdate(SQLModel):
    name: Optional[str] = None
    db_type: Optional[str] = None
    sqlite_path: Optional[str] = None
    postgres_host: Optional[str] = None
    postgres_port: Optional[int] = None
    postgres_database: Optional[str] = None
    postgres_username: Optional[str] = None
    postgres_password: Optional[str] = None
    postgres_sslmode: Optional[str] = None


class WipeDataDbRequest(SQLModel):
    confirmation_text: str


class DBConnectionRead(DBConnectionBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    connection_summary: str


class UserAccount(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    password_hash: str
    employee_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_admin: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserAccountCreate(SQLModel):
    username: str
    password: str
    employee_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_admin: bool = False


class UserAccountUpdate(SQLModel):
    password: Optional[str] = None
    employee_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class UserAccountRead(SQLModel):
    id: int
    username: str
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_admin: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    auth_source: str = "database"


class AccountSettingsRead(SQLModel):
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    profile_picture_url: Optional[str] = None
    mm_user_account: bool = False
    auth_source: str = "env"
    is_admin: bool = False
    is_active: bool = True


class AccountSettingsUpdate(SQLModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    profile_picture_url: Optional[str] = None


class InboxNotification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    title: str
    message: str
    metadata_json: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InboxNotificationRead(SQLModel):
    id: int
    username: str
    title: str
    message: str
    payload: Optional[dict[str, Any]] = None
    is_actionable: bool = False
    is_read: bool
    created_at: datetime


app = FastAPI(title="Matrix Manager", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_auth_username() -> str:
    return os.getenv("MATRIX_AUTH_USERNAME", "admin")


def get_auth_password() -> str:
    return os.getenv("MATRIX_AUTH_PASSWORD", "changeme")


def get_session_secret() -> str:
    return os.getenv("MATRIX_AUTH_SECRET") or f"{get_auth_username()}:{get_auth_password()}"


def hash_password(password: str, salt: Optional[bytes] = None) -> str:
    salt_bytes = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, 600000)
    return f"pbkdf2_sha256$600000${base64.b64encode(salt_bytes).decode('ascii')}${base64.b64encode(digest).decode('ascii')}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        salt = base64.b64decode(salt_text.encode("ascii"))
        expected = base64.b64decode(digest_text.encode("ascii"))
    except Exception:
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return secrets.compare_digest(candidate, expected)


def sign_session_value(username: str) -> str:
    secret = get_session_secret().encode("utf-8")
    payload = username.encode("utf-8")
    digest = hmac.new(secret, payload, hashlib.sha256).hexdigest()
    return f"{username}:{digest}"


def user_exists(username: str) -> bool:
    with Session(control_engine) as session:
        user = session.exec(select(UserAccount).where(UserAccount.username == username)).first()
        return bool(user and user.is_active)


def verify_session_value(cookie_value: Optional[str]) -> bool:
    if not cookie_value or ":" not in cookie_value:
        return False
    username, provided_sig = cookie_value.split(":", 1)
    expected = sign_session_value(username)
    signature_ok = secrets.compare_digest(cookie_value, expected) and secrets.compare_digest(provided_sig, expected.split(":", 1)[1])
    if not signature_ok:
        return False
    if username == get_auth_username():
        return True
    return user_exists(username)


def get_session_username(cookie_value: Optional[str]) -> Optional[str]:
    if not verify_session_value(cookie_value):
        return None
    return cookie_value.split(":", 1)[0]


def render_app_nav(current_path: str, username: str) -> str:
    links = [
        ("/", "Home"),
        ("/planning", "Projects"),
        ("/canvas", "Canvas"),
    ]
    staffing_links = [
        ("/dashboard", "Forecast"),
        ("/demands", "Demands"),
        ("/staffing", "Assignments"),
    ]
    people_links = [
        ("/orgs", "Organizations"),
        ("/people", "Employees"),
        ("/job-codes", "Job Codes"),
    ]
    admin_links: list[tuple[str, str]] = []
    if is_admin_username(username):
        admin_links = [
            ("/users", "Users"),
            ("/audit", "Audit"),
            ("/runtime", "System Health"),
            ("/db-management", "Databases"),
        ]

    def render_standard_links(nav_links: list[tuple[str, str]]) -> str:
        rendered = []
        for href, label in nav_links:
            class_name = "nav-link active" if href == current_path else "nav-link"
            aria_current = ' aria-current="page"' if href == current_path else ""
            nav_meta = ' data-nav-key="assignments"' if href == "/staffing" else ""
            rendered.append(f'<a href="{href}" class="{class_name}"{aria_current}{nav_meta}>{label}</a>')
        return "".join(rendered)

    def render_dropdown(label: str, nav_links: list[tuple[str, str]], mobile: bool = False) -> str:
        if not nav_links:
            return ""
        rendered = []
        for href, item_label in nav_links:
            class_name = "nav-dropdown-link active" if href == current_path else "nav-dropdown-link"
            aria_current = ' aria-current="page"' if href == current_path else ""
            nav_meta = ' data-nav-key="assignments"' if href == "/staffing" else ""
            rendered.append(f'<a href="{href}" class="{class_name}"{aria_current}{nav_meta}>{item_label}</a>')
        panel_class = "nav-dropdown-panel nav-dropdown-panel-mobile" if mobile else "nav-dropdown-panel"
        details_class = "nav-dropdown nav-dropdown-mobile" if mobile else "nav-dropdown"
        trigger_class = "nav-link nav-dropdown-trigger active" if any(href == current_path for href, _ in nav_links) else "nav-link nav-dropdown-trigger"
        trigger_meta = ' data-nav-key="staffing-trigger"' if label == "Planning" else ""
        return f'''
          <details class="{details_class}">
            <summary class="{trigger_class}"{trigger_meta}>
              <span>{label}</span>
              <span class="nav-dropdown-caret" aria-hidden="true">▾</span>
            </summary>
            <div class="{panel_class}">
              {"".join(rendered)}
            </div>
          </details>
        '''

    link_markup = render_standard_links(links)
    staffing_link_markup = render_dropdown("Planning", staffing_links)
    mobile_staffing_markup = render_dropdown("Planning", staffing_links, mobile=True)
    people_link_markup = render_dropdown("Workforce", people_links)
    mobile_people_markup = render_dropdown("Workforce", people_links, mobile=True)
    admin_link_markup = render_dropdown("Administration", admin_links) if admin_links else ""
    mobile_admin_markup = render_dropdown("Administration", admin_links, mobile=True) if admin_links else ""
    return f'''<nav class="app-nav" aria-label="Primary">
        <div class="app-nav-main">
          <div class="nav-links nav-links-desktop">{link_markup}{staffing_link_markup}{people_link_markup}{admin_link_markup}</div>
          <details class="hamburger-menu">
            <summary class="hamburger-trigger" aria-label="Open navigation menu">
              <span class="hamburger-icon" aria-hidden="true"></span>
              <span>Menu</span>
            </summary>
            <div class="hamburger-panel">
              <div class="nav-links nav-links-mobile">{link_markup}{mobile_staffing_markup}{mobile_people_markup}{mobile_admin_markup}</div>
            </div>
          </details>
        </div>
        <details class="account-menu">
          <summary class="account-menu-trigger">
            <span class="account-icon" aria-hidden="true">👤</span>
            <span class="account-menu-copy">
              <span class="account-menu-label">Signed in as</span>
              <span class="account-menu-username">{username}</span>
            </span>
          </summary>
          <div class="account-menu-panel">
            <div class="account-menu-meta">
              <div class="account-menu-meta-top">
                <span class="account-icon account-icon-panel" aria-hidden="true">👤</span>
                <div>
                  <span class="account-menu-label">Signed in as</span>
                  <strong>{username}</strong>
                </div>
              </div>
            </div>
            <a href="/inbox" class="account-menu-link">Inbox</a>
            <a href="/account-settings" class="account-menu-link">Account Settings</a>
            <form method="post" action="/logout" class="logout-form">
              <button type="submit" class="logout-button">Logout</button>
            </form>
          </div>
        </details>
      </nav>'''


def build_login_page(error: str = "", next_path: str = "/") -> str:
    error_markup = f'<p class="login-error">{error}</p>' if error else ""
    styles_href = static_asset_url("styles.css")
    favicon_href = static_asset_url("images/matrix-manager-favicon.ico")
    logo_href = static_asset_url("images/matrix-manager-favicon.svg")
    safe_next = next_path if next_path.startswith("/") else "/"
    return f"""<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>Matrix Manager · Login</title>
    <link rel=\"icon\" href=\"{favicon_href}\" sizes=\"any\" />
    <link rel=\"stylesheet\" href=\"{styles_href}\" />
  </head>
  <body class=\"login-page\">
    <main class=\"login-shell\">
      <section class=\"card login-card\">
        <div class=\"section-head login-head\">
          <img src=\"{logo_href}\" alt=\"Matrix Management\" class=\"login-logo\" />
          <h1>Matrix Manager</h1>
          <p>Sign in to continue.</p>
        </div>
        {error_markup}
        <form method=\"post\" action=\"/login\" class=\"panel\">
          <input type=\"hidden\" name=\"next\" value=\"{safe_next}\" />
          <label><span class=\"label-text required-field\">Username</span><input name=\"username\" autocomplete=\"username\" required /></label>
          <label><span class=\"label-text required-field\">Password</span><input name=\"password\" type=\"password\" autocomplete=\"current-password\" required /></label>
          <button type=\"submit\">Sign in</button>
        </form>
      </section>
    </main>
  </body>
</html>"""


def is_html_request(request: Request) -> bool:
    accept = request.headers.get("accept", "")
    return "text/html" in accept or request.url.path in {"/", "/planning", "/demands", "/people", "/staffing", "/orgs", "/job-codes", "/canvas", "/dashboard", "/inbox", "/account-settings", "/audit", "/users", "/db-management", "/runtime", "/docs", "/redoc"}


def create_db_and_tables(bind_engine=engine) -> None:
    SQLModel.metadata.create_all(bind_engine)


def run_migrations(bind_engine=engine) -> None:
    engine_url = str(bind_engine.url)
    with bind_engine.begin() as connection:
        if engine_url.startswith("sqlite"):
            columns = connection.exec_driver_sql("PRAGMA table_info(employee)").fetchall()
            column_names = {row[1] for row in columns}
            if "manager_id" not in column_names:
                connection.exec_driver_sql("ALTER TABLE employee ADD COLUMN manager_id INTEGER")
            if "employee_type" not in column_names:
                connection.exec_driver_sql("ALTER TABLE employee ADD COLUMN employee_type TEXT DEFAULT 'IC'")
            if "job_code_id" not in column_names:
                connection.exec_driver_sql("ALTER TABLE employee ADD COLUMN job_code_id INTEGER")
            organization_columns = connection.exec_driver_sql("PRAGMA table_info(organization)").fetchall() if connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table' AND name='organization'").fetchone() else []
            organization_column_names = {row[1] for row in organization_columns}
            if organization_columns and "parent_organization_id" not in organization_column_names:
                connection.exec_driver_sql("ALTER TABLE organization ADD COLUMN parent_organization_id INTEGER")
            if organization_columns and "owner_employee_id" not in organization_column_names:
                connection.exec_driver_sql("ALTER TABLE organization ADD COLUMN owner_employee_id INTEGER")
            demand_columns = connection.exec_driver_sql("PRAGMA table_info(demand)").fetchall() if connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table' AND name='demand'").fetchone() else []
            demand_column_names = {row[1] for row in demand_columns}
            if demand_columns and "organization_id" not in demand_column_names:
                connection.exec_driver_sql("ALTER TABLE demand ADD COLUMN organization_id INTEGER")
            assignment_columns = connection.exec_driver_sql("PRAGMA table_info(assignment)").fetchall()
            assignment_column_names = {row[1] for row in assignment_columns}
            if "demand_id" not in assignment_column_names:
                connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN demand_id INTEGER")
            if "status" not in assignment_column_names:
                connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN status TEXT DEFAULT 'approved'")
            if "submitted_by_username" not in assignment_column_names:
                connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN submitted_by_username TEXT")
            if "approved_by_username" not in assignment_column_names:
                connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN approved_by_username TEXT")
            if "denied_by_username" not in assignment_column_names:
                connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN denied_by_username TEXT")
            if "reviewed_at" not in assignment_column_names:
                connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN reviewed_at TEXT")
            control_columns = connection.exec_driver_sql("PRAGMA table_info(useraccount)").fetchall() if connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table' AND name='useraccount'").fetchone() else []
            control_column_names = {row[1] for row in control_columns}
            if control_columns and "employee_id" not in control_column_names:
                connection.exec_driver_sql("ALTER TABLE useraccount ADD COLUMN employee_id INTEGER")
            if control_columns and "first_name" not in control_column_names:
                connection.exec_driver_sql("ALTER TABLE useraccount ADD COLUMN first_name TEXT")
            if control_columns and "last_name" not in control_column_names:
                connection.exec_driver_sql("ALTER TABLE useraccount ADD COLUMN last_name TEXT")
            if control_columns and "email" not in control_column_names:
                connection.exec_driver_sql("ALTER TABLE useraccount ADD COLUMN email TEXT")
            if control_columns and "profile_picture_url" not in control_column_names:
                connection.exec_driver_sql("ALTER TABLE useraccount ADD COLUMN profile_picture_url TEXT")
            inbox_columns = connection.exec_driver_sql("PRAGMA table_info(inboxnotification)").fetchall() if connection.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table' AND name='inboxnotification'").fetchone() else []
            inbox_column_names = {row[1] for row in inbox_columns}
            if inbox_columns and "metadata_json" not in inbox_column_names:
                connection.exec_driver_sql("ALTER TABLE inboxnotification ADD COLUMN metadata_json TEXT")
            connection.exec_driver_sql("UPDATE employee SET employee_type = 'IC' WHERE employee_type IS NULL OR employee_type = ''")
        else:
            employee_exists = connection.exec_driver_sql("SELECT to_regclass('public.employee')").scalar()
            if employee_exists:
                column_rows = connection.exec_driver_sql("SELECT column_name FROM information_schema.columns WHERE table_name = 'employee'").fetchall()
                column_names = {row[0] for row in column_rows}
                if "manager_id" not in column_names:
                    connection.exec_driver_sql("ALTER TABLE employee ADD COLUMN manager_id INTEGER")
                if "employee_type" not in column_names:
                    connection.exec_driver_sql("ALTER TABLE employee ADD COLUMN employee_type TEXT DEFAULT 'IC'")
                if "job_code_id" not in column_names:
                    connection.exec_driver_sql("ALTER TABLE employee ADD COLUMN job_code_id INTEGER")
                organization_exists = connection.exec_driver_sql("SELECT to_regclass('public.organization')").scalar()
                if organization_exists:
                    organization_rows = connection.exec_driver_sql("SELECT column_name FROM information_schema.columns WHERE table_name = 'organization'").fetchall()
                    organization_column_names = {row[0] for row in organization_rows}
                    if "parent_organization_id" not in organization_column_names:
                        connection.exec_driver_sql("ALTER TABLE organization ADD COLUMN parent_organization_id INTEGER")
                    if "owner_employee_id" not in organization_column_names:
                        connection.exec_driver_sql("ALTER TABLE organization ADD COLUMN owner_employee_id INTEGER")
                demand_exists = connection.exec_driver_sql("SELECT to_regclass('public.demand')").scalar()
                if demand_exists:
                    demand_rows = connection.exec_driver_sql("SELECT column_name FROM information_schema.columns WHERE table_name = 'demand'").fetchall()
                    demand_column_names = {row[0] for row in demand_rows}
                    if "organization_id" not in demand_column_names:
                        connection.exec_driver_sql("ALTER TABLE demand ADD COLUMN organization_id INTEGER")
                assignment_exists = connection.exec_driver_sql("SELECT to_regclass('public.assignment')").scalar()
                if assignment_exists:
                    assignment_rows = connection.exec_driver_sql("SELECT column_name FROM information_schema.columns WHERE table_name = 'assignment'").fetchall()
                    assignment_column_names = {row[0] for row in assignment_rows}
                    if "demand_id" not in assignment_column_names:
                        connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN demand_id INTEGER")
                    if "status" not in assignment_column_names:
                        connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN status TEXT DEFAULT 'approved'")
                    if "submitted_by_username" not in assignment_column_names:
                        connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN submitted_by_username TEXT")
                    if "approved_by_username" not in assignment_column_names:
                        connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN approved_by_username TEXT")
                    if "denied_by_username" not in assignment_column_names:
                        connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN denied_by_username TEXT")
                    if "reviewed_at" not in assignment_column_names:
                        connection.exec_driver_sql("ALTER TABLE assignment ADD COLUMN reviewed_at TIMESTAMPTZ")
                useraccount_exists = connection.exec_driver_sql("SELECT to_regclass('public.useraccount')").scalar()
                if useraccount_exists:
                    user_rows = connection.exec_driver_sql("SELECT column_name FROM information_schema.columns WHERE table_name = 'useraccount'").fetchall()
                    user_column_names = {row[0] for row in user_rows}
                    if "employee_id" not in user_column_names:
                        connection.exec_driver_sql("ALTER TABLE useraccount ADD COLUMN employee_id INTEGER")
                    if "first_name" not in user_column_names:
                        connection.exec_driver_sql("ALTER TABLE useraccount ADD COLUMN first_name TEXT")
                    if "last_name" not in user_column_names:
                        connection.exec_driver_sql("ALTER TABLE useraccount ADD COLUMN last_name TEXT")
                    if "email" not in user_column_names:
                        connection.exec_driver_sql("ALTER TABLE useraccount ADD COLUMN email TEXT")
                    if "profile_picture_url" not in user_column_names:
                        connection.exec_driver_sql("ALTER TABLE useraccount ADD COLUMN profile_picture_url TEXT")
                inbox_exists = connection.exec_driver_sql("SELECT to_regclass('public.inboxnotification')").scalar()
                if inbox_exists:
                    inbox_rows = connection.exec_driver_sql("SELECT column_name FROM information_schema.columns WHERE table_name = 'inboxnotification'").fetchall()
                    inbox_column_names = {row[0] for row in inbox_rows}
                    if "metadata_json" not in inbox_column_names:
                        connection.exec_driver_sql("ALTER TABLE inboxnotification ADD COLUMN metadata_json TEXT")
                connection.exec_driver_sql("UPDATE employee SET employee_type = 'IC' WHERE employee_type IS NULL OR employee_type = ''")
        AuditEntry.__table__.create(bind=connection, checkfirst=True)
        RuntimeErrorLog.__table__.create(bind=connection, checkfirst=True)
        RuntimeHealthSnapshot.__table__.create(bind=connection, checkfirst=True)
        DBConnectionConfig.__table__.create(bind=connection, checkfirst=True)
        UserAccount.__table__.create(bind=connection, checkfirst=True)
        InboxNotification.__table__.create(bind=connection, checkfirst=True)
        JobCode.__table__.create(bind=connection, checkfirst=True)
        Demand.__table__.create(bind=connection, checkfirst=True)


def get_control_session() -> Generator[Session, None, None]:
    create_db_and_tables(control_engine)
    run_migrations(control_engine)
    with Session(control_engine) as session:
        yield session


def wipe_primary_data_db() -> None:
    active_connection = get_active_db_connection_config()
    data_engine = get_or_create_data_engine(active_connection)
    data_tables = [Assignment.__table__, Demand.__table__, Project.__table__, Employee.__table__, Organization.__table__, JobCode.__table__]
    for table in data_tables:
        table.drop(bind=data_engine, checkfirst=True)
    for table in [Organization.__table__, JobCode.__table__, Employee.__table__, Project.__table__, Demand.__table__, Assignment.__table__]:
        table.create(bind=data_engine, checkfirst=True)
    run_migrations(data_engine)


def build_connection_summary(connection: DBConnectionConfig) -> str:
    if connection.db_type == "sqlite":
        return connection.sqlite_path or "SQLite"
    return f"{connection.postgres_host or 'localhost'}:{connection.postgres_port}/{connection.postgres_database or ''}"


def serialize_db_connection(connection: DBConnectionConfig) -> DBConnectionRead:
    return DBConnectionRead(
        id=connection.id,
        name=connection.name,
        db_type=connection.db_type,
        sqlite_path=connection.sqlite_path,
        postgres_host=connection.postgres_host,
        postgres_port=connection.postgres_port,
        postgres_database=connection.postgres_database,
        postgres_username=connection.postgres_username,
        postgres_password=connection.postgres_password,
        postgres_sslmode=connection.postgres_sslmode,
        is_active=connection.is_active,
        created_at=connection.created_at,
        updated_at=connection.updated_at,
        connection_summary=build_connection_summary(connection),
    )


def normalize_db_connection_payload(payload: dict[str, Any]) -> dict[str, Any]:
    db_type = (payload.get("db_type") or "").strip().lower()
    if db_type not in {"sqlite", "postgresql"}:
        raise HTTPException(status_code=400, detail="Database type must be sqlite or postgresql")
    payload["db_type"] = db_type
    payload["name"] = (payload.get("name") or "").strip()
    if not payload["name"]:
        raise HTTPException(status_code=400, detail="Connection name is required")
    if db_type == "sqlite":
        sqlite_path = (payload.get("sqlite_path") or "").strip()
        if not sqlite_path:
            raise HTTPException(status_code=400, detail="SQLite path is required")
        payload.update({
            "sqlite_path": sqlite_path,
            "postgres_host": None,
            "postgres_database": None,
            "postgres_username": None,
            "postgres_password": None,
            "postgres_sslmode": "prefer",
            "postgres_port": 5432,
        })
    else:
        host = (payload.get("postgres_host") or "").strip()
        database = (payload.get("postgres_database") or "").strip()
        username = (payload.get("postgres_username") or "").strip()
        password = payload.get("postgres_password") or ""
        if not host or not database or not username:
            raise HTTPException(status_code=400, detail="PostgreSQL host, database, and username are required")
        payload.update({
            "sqlite_path": None,
            "postgres_host": host,
            "postgres_database": database,
            "postgres_username": username,
            "postgres_password": password,
            "postgres_sslmode": (payload.get("postgres_sslmode") or "prefer").strip() or "prefer",
            "postgres_port": int(payload.get("postgres_port") or 5432),
        })
    return payload


def build_database_url(connection: DBConnectionConfig) -> str:
    if connection.db_type == "sqlite":
        sqlite_path = Path(connection.sqlite_path or "matrix.db").expanduser()
        if not sqlite_path.is_absolute():
            sqlite_path = ROOT_DIR / sqlite_path
        return f"sqlite:///{sqlite_path}"
    username = quote_plus(connection.postgres_username or "")
    password = connection.postgres_password or ""
    auth = username
    if password:
        auth = f"{username}:{quote_plus(password)}"
    database = quote_plus(connection.postgres_database or "")
    host = connection.postgres_host or "localhost"
    return f"postgresql+psycopg://{auth}@{host}:{connection.postgres_port}/{database}?sslmode={connection.postgres_sslmode or 'prefer'}"


def get_or_create_data_engine(connection: DBConnectionConfig):
    global engine
    database_url = build_database_url(connection)
    if database_url in engine_cache:
        engine = engine_cache[database_url]
        return engine
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    built_engine = create_engine(database_url, connect_args=connect_args)
    create_db_and_tables(built_engine)
    run_migrations(built_engine)
    engine_cache[database_url] = built_engine
    engine = built_engine
    return built_engine


def build_bootstrap_connection() -> DBConnectionConfig:
    if MATRIX_ACTIVE_DB_TYPE == "postgresql":
        return DBConnectionConfig(
            name="Bundled PostgreSQL",
            db_type="postgresql",
            postgres_host=POSTGRES_HOST,
            postgres_port=POSTGRES_PORT,
            postgres_database=POSTGRES_DB,
            postgres_username=POSTGRES_USER,
            postgres_password=POSTGRES_PASSWORD,
            postgres_sslmode=POSTGRES_SSLMODE,
            is_active=True,
        )
    return DBConnectionConfig(
        name="Local SQLite",
        db_type="sqlite",
        sqlite_path=str(DB_PATH),
        is_active=True,
    )


def ensure_default_db_connection() -> None:
    bootstrap_connection = build_bootstrap_connection()
    with Session(control_engine) as session:
        existing = session.exec(select(DBConnectionConfig).order_by(DBConnectionConfig.id)).all()
        if existing:
            active_matches_bootstrap = False
            for item in existing:
                should_be_active = False
                if bootstrap_connection.db_type == "sqlite":
                    should_be_active = item.db_type == "sqlite" and (item.sqlite_path or "") == (bootstrap_connection.sqlite_path or "")
                else:
                    should_be_active = (
                        item.db_type == "postgresql"
                        and (item.postgres_host or "") == (bootstrap_connection.postgres_host or "")
                        and int(item.postgres_port or 5432) == int(bootstrap_connection.postgres_port or 5432)
                        and (item.postgres_database or "") == (bootstrap_connection.postgres_database or "")
                        and (item.postgres_username or "") == (bootstrap_connection.postgres_username or "")
                    )
                if should_be_active:
                    item.name = bootstrap_connection.name
                    item.db_type = bootstrap_connection.db_type
                    item.sqlite_path = bootstrap_connection.sqlite_path
                    item.postgres_host = bootstrap_connection.postgres_host
                    item.postgres_port = bootstrap_connection.postgres_port
                    item.postgres_database = bootstrap_connection.postgres_database
                    item.postgres_username = bootstrap_connection.postgres_username
                    item.postgres_password = bootstrap_connection.postgres_password
                    item.postgres_sslmode = bootstrap_connection.postgres_sslmode
                    item.is_active = True
                    item.updated_at = datetime.now(timezone.utc)
                    session.add(item)
                    active_matches_bootstrap = True
                elif item.is_active and MATRIX_INSTALL_MODE in {"sqlite", "postgresql"}:
                    item.is_active = False
                    item.updated_at = datetime.now(timezone.utc)
                    session.add(item)
            if not active_matches_bootstrap:
                bootstrap_connection.updated_at = datetime.now(timezone.utc)
                session.add(bootstrap_connection)
            session.commit()
            if not any(item.is_active for item in session.exec(select(DBConnectionConfig)).all()):
                first = session.exec(select(DBConnectionConfig).order_by(DBConnectionConfig.id)).first()
                if first:
                    first.is_active = True
                    first.updated_at = datetime.now(timezone.utc)
                    session.add(first)
                    session.commit()
            return
        session.add(bootstrap_connection)
        session.commit()


def get_active_db_connection_config() -> DBConnectionConfig:
    with Session(control_engine) as session:
        connection = session.exec(select(DBConnectionConfig).where(DBConnectionConfig.is_active == True)).first()
        if connection:
            return connection
        fallback = session.exec(select(DBConnectionConfig).order_by(DBConnectionConfig.id)).first()
        if not fallback:
            raise HTTPException(status_code=500, detail="No database connections configured")
        return fallback


def get_session() -> Generator[Session, None, None]:
    active_connection = get_active_db_connection_config()
    data_engine = get_or_create_data_engine(active_connection)
    with Session(data_engine) as session:
        yield session


def static_asset_url(relative_path: str) -> str:
    asset_path = STATIC_DIR / relative_path
    version = int(asset_path.stat().st_mtime) if asset_path.exists() else 0
    return f"/static/{relative_path}?v={version}"


def get_request_username(request: Request) -> str:
    return get_session_username(request.cookies.get(SESSION_COOKIE_NAME)) or "unknown"


def is_database_admin(username: Optional[str]) -> bool:
    if not username:
        return False
    with Session(control_engine) as session:
        user = session.exec(select(UserAccount).where(UserAccount.username == username)).first()
        return bool(user and user.is_active and user.is_admin)


def authenticate_username_password(username: str, password: str) -> bool:
    if secrets.compare_digest(username, get_auth_username()) and secrets.compare_digest(password, get_auth_password()):
        return True
    with Session(control_engine) as session:
        user = session.exec(select(UserAccount).where(UserAccount.username == username)).first()
        if not user or not user.is_active:
            return False
        return verify_password(password, user.password_hash)


def serialize_user_account(user: UserAccount) -> UserAccountRead:
    employee_name = None
    if user.employee_id is not None:
        active_connection = get_active_db_connection_config()
        data_engine = get_or_create_data_engine(active_connection)
        with Session(data_engine) as session:
            employee = session.get(Employee, user.employee_id)
            employee_name = employee.name if employee else None
    return UserAccountRead(
        id=user.id,
        username=user.username,
        employee_id=user.employee_id,
        employee_name=employee_name,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        profile_picture_url=user.profile_picture_url,
        is_admin=user.is_admin,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        auth_source="database",
    )


def get_account_settings(username: str, session: Session) -> AccountSettingsRead:
    user = session.exec(select(UserAccount).where(UserAccount.username == username)).first()
    if user:
        serialized = serialize_user_account(user)
        return AccountSettingsRead(
            username=serialized.username,
            first_name=serialized.first_name,
            last_name=serialized.last_name,
            email=serialized.email,
            profile_picture_url=serialized.profile_picture_url,
            mm_user_account=True,
            auth_source=serialized.auth_source,
            is_admin=serialized.is_admin,
            is_active=serialized.is_active,
        )
    return AccountSettingsRead(
        username=username,
        mm_user_account=False,
        auth_source="env",
        is_admin=is_admin_username(username),
        is_active=True,
    )


def is_admin_username(username: Optional[str]) -> bool:
    return username == "admin" or is_database_admin(username)


def require_admin_user(request: Request) -> str:
    username = get_request_username(request)
    if not is_admin_username(username):
        raise HTTPException(status_code=403, detail="Only the admin user can perform this action")
    return username


def jsonable_audit_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def audit_snapshot_from_model(model: Any, extra: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    if model is None:
        data: dict[str, Any] = {}
    elif hasattr(model, "model_dump"):
        data = model.model_dump()
    elif hasattr(model, "dict"):
        data = model.dict()
    elif isinstance(model, dict):
        data = dict(model)
    else:
        data = {"value": str(model)}
    if extra:
        data.update(extra)
    return {key: jsonable_audit_value(value) for key, value in data.items()}


def dump_audit_json(value: Optional[dict[str, Any]]) -> Optional[str]:
    if value is None:
        return None
    return json.dumps(value, sort_keys=True)


def serialize_audit_entry(entry: AuditEntry) -> AuditEntryRead:
    return AuditEntryRead(
        id=entry.id,
        entity_type=entry.entity_type,
        entity_id=entry.entity_id,
        entity_label=entry.entity_label,
        action=entry.action,
        actor_username=entry.actor_username,
        occurred_at=entry.occurred_at,
        before_json=entry.before_json,
        after_json=entry.after_json,
    )


def serialize_runtime_error(entry: RuntimeErrorLog) -> RuntimeErrorLogRead:
    return RuntimeErrorLogRead(
        id=entry.id,
        occurred_at=entry.occurred_at,
        path=entry.path,
        method=entry.method,
        username=entry.username,
        error_type=entry.error_type,
        message=entry.message,
        traceback_text=entry.traceback_text,
    )


def record_runtime_error(exc: Exception, request: Optional[Request] = None) -> None:
    try:
        with Session(control_engine) as session:
            entry = RuntimeErrorLog(
                path=str(request.url.path) if request else None,
                method=request.method if request else None,
                username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)) if request else None,
                error_type=exc.__class__.__name__,
                message=str(exc),
                traceback_text="".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
            )
            session.add(entry)
            session.commit()
    except Exception:
        pass


def serialize_runtime_snapshot(entry: RuntimeHealthSnapshot) -> RuntimeHealthSnapshotRead:
    return RuntimeHealthSnapshotRead(
        id=entry.id,
        occurred_at=entry.occurred_at,
        overall_status=entry.overall_status,
        control_db_status=entry.control_db_status,
        active_data_db_status=entry.active_data_db_status,
        docker_status=entry.docker_status,
        error_count_last_hour=entry.error_count_last_hour,
        details=json.loads(entry.details_json) if entry.details_json else None,
    )


def probe_sqlite_path(path_text: str) -> RuntimeDbStatusRead:
    started = time.perf_counter()
    try:
        path = Path(path_text).expanduser()
        if not path.is_absolute():
            path = ROOT_DIR / path
        exists = path.exists()
        with create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False}).connect() as connection:
            connection.exec_driver_sql("SELECT 1")
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        return RuntimeDbStatusRead(
            name=path.name,
            db_type="sqlite",
            is_active=False,
            status="ok",
            detail=f"{path} ({'exists' if exists else 'created on connect'})",
            latency_ms=latency_ms,
        )
    except Exception as exc:
        return RuntimeDbStatusRead(name=Path(path_text).name or "sqlite", db_type="sqlite", is_active=False, status="error", detail=str(exc))


def probe_db_connection(connection: DBConnectionConfig) -> RuntimeDbStatusRead:
    started = time.perf_counter()
    try:
        built_engine = create_engine(build_database_url(connection), connect_args={"check_same_thread": False} if connection.db_type == "sqlite" else {})
        with built_engine.connect() as db_conn:
            db_conn.exec_driver_sql("SELECT 1")
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        detail = build_connection_summary(connection)
        return RuntimeDbStatusRead(
            name=connection.name,
            db_type=connection.db_type,
            is_active=connection.is_active,
            status="ok",
            detail=detail,
            latency_ms=latency_ms,
        )
    except Exception as exc:
        return RuntimeDbStatusRead(
            name=connection.name,
            db_type=connection.db_type,
            is_active=connection.is_active,
            status="error",
            detail=str(exc),
        )


def format_timedelta_short(delta: timedelta) -> str:
    total_seconds = max(0, int(delta.total_seconds()))
    days, remainder = divmod(total_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, _ = divmod(remainder, 60)
    if days:
        return f"{days}d {hours}h"
    if hours:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def inspect_docker_container(container_name: str) -> dict[str, Any]:
    result = subprocess.run(
        ["docker", "inspect", container_name],
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
        timeout=8,
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return {}
    try:
        payload = json.loads(result.stdout)
        return payload[0] if payload else {}
    except Exception:
        return {}


def get_docker_service_status() -> tuple[bool, Optional[str], list[RuntimeServiceStatusRead]]:
    services: list[RuntimeServiceStatusRead] = []
    docker_error = None
    docker_available = False
    try:
        result = subprocess.run(
            ["docker", "compose", "ps", "--format", "json"],
            cwd=str(ROOT_DIR),
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
        if result.returncode == 0:
            docker_available = True
            lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
            for line in lines:
                item = json.loads(line)
                inspect_target = item.get("Name") or item.get("ID") or item.get("Service")
                inspect_payload = inspect_docker_container(inspect_target) if inspect_target else {}
                state_info = inspect_payload.get("State") or {}
                started_at = state_info.get("StartedAt")
                uptime = None
                if started_at and started_at != "0001-01-01T00:00:00Z":
                    try:
                        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                        uptime = format_timedelta_short(datetime.now(timezone.utc) - started_dt)
                    except Exception:
                        uptime = None
                restart_count = inspect_payload.get("RestartCount")
                image_name = (inspect_payload.get("Config") or {}).get("Image") or item.get("Image")
                services.append(
                    RuntimeServiceStatusRead(
                        name=item.get("Service") or item.get("Name") or "unknown",
                        state=item.get("State") or "unknown",
                        health=item.get("Health"),
                        status_text=item.get("Status") or item.get("Publishers"),
                        uptime=uptime,
                        restart_count=restart_count if isinstance(restart_count, int) else None,
                        image=image_name,
                    )
                )
        else:
            docker_error = (result.stderr or result.stdout or "docker compose ps failed").strip()
    except Exception as exc:
        docker_error = str(exc)
    return docker_available, docker_error, services


def get_installed_versions(docker_available: bool) -> list[RuntimeVersionRead]:
    versions = [
        RuntimeVersionRead(name="Matrix Management", version=MATRIXMANAGER_VERSION, source="env/runtime"),
        RuntimeVersionRead(name="Python", version=os.sys.version.split()[0], source="runtime"),
        RuntimeVersionRead(name="FastAPI", version=getattr(fastapi, "__version__", "unknown"), source="python package"),
        RuntimeVersionRead(name="SQLModel", version=getattr(sqlmodel, "__version__", "unknown"), source="python package"),
    ]
    try:
        sqlite_version = create_engine("sqlite://", connect_args={"check_same_thread": False}).connect().exec_driver_sql("select sqlite_version()").scalar()
        versions.append(RuntimeVersionRead(name="SQLite", version=str(sqlite_version), source="sqlite runtime"))
    except Exception:
        pass
    try:
        node_result = subprocess.run(["node", "--version"], cwd=str(ROOT_DIR), capture_output=True, text=True, timeout=5, check=False)
        if node_result.returncode == 0:
            versions.append(RuntimeVersionRead(name="Node.js", version=node_result.stdout.strip().lstrip("v"), source="node runtime"))
    except Exception:
        pass
    if docker_available:
        try:
            docker_result = subprocess.run(["docker", "--version"], cwd=str(ROOT_DIR), capture_output=True, text=True, timeout=5, check=False)
            if docker_result.returncode == 0:
                versions.append(RuntimeVersionRead(name="Docker", version=docker_result.stdout.strip(), source="docker cli"))
        except Exception:
            pass
    return versions


def compute_runtime_overview() -> RuntimeOverviewRead:
    checked_at = datetime.now(timezone.utc)
    docker_available, docker_error, services = get_docker_service_status()
    with Session(control_engine) as control_session:
        recent_cutoff = checked_at - timedelta(hours=1)
        recent_errors = control_session.exec(select(RuntimeErrorLog).where(RuntimeErrorLog.occurred_at >= recent_cutoff)).all()
        latest_snapshot_entry = control_session.exec(select(RuntimeHealthSnapshot).order_by(RuntimeHealthSnapshot.occurred_at.desc(), RuntimeHealthSnapshot.id.desc())).first()
        connection_configs = control_session.exec(select(DBConnectionConfig).order_by(DBConnectionConfig.name)).all()
        control_started = time.perf_counter()
        try:
            control_session.exec(select(UserAccount).limit(1)).first()
            control_db_status = "ok"
            control_db_detail = f"control db reachable ({round((time.perf_counter() - control_started) * 1000, 2)} ms)"
        except Exception as exc:
            control_db_status = "error"
            control_db_detail = str(exc)
        db_connections = [probe_db_connection(connection) for connection in connection_configs]
        if not any(item.db_type == "sqlite" and item.detail and str(DB_PATH) in item.detail for item in db_connections):
            db_connections.append(probe_sqlite_path(str(DB_PATH)))
        active_db_entry = next((item for item in db_connections if item.is_active), None)
        active_data_db_status = active_db_entry.status if active_db_entry else "unknown"
        active_data_db_detail = active_db_entry.detail if active_db_entry else "No active DB connection configured"
        docker_status = "ok" if docker_available else ("degraded" if docker_error else "unknown")
        status_values = [control_db_status, active_data_db_status, docker_status]
        overall_status = "error" if "error" in status_values else "degraded" if "degraded" in status_values else "ok"
        recommended_actions: list[str] = []
        if control_db_status != "ok":
            recommended_actions.append("Control DB probe failed — verify MATRIX_CONTROL_DB_PATH, file permissions, or DB server reachability.")
        if active_data_db_status != "ok":
            recommended_actions.append("Active data DB probe failed — review the active DB connection profile and test SQLite/PostgreSQL connectivity.")
        if docker_error:
            recommended_actions.append("Docker status is unavailable from the app runtime — mount Docker socket/CLI into the container or treat container visibility as informational only.")
        if len(recent_errors) > 0:
            recommended_actions.append("Recent runtime errors were captured — review grouped errors and raw tracebacks below to find recurring failures.")
        installed_versions = get_installed_versions(docker_available)
        return RuntimeOverviewRead(
            runtime_environment="docker" if Path("/.dockerenv").exists() else "host",
            active_db_type=MATRIX_ACTIVE_DB_TYPE,
            install_mode=MATRIX_INSTALL_MODE,
            docker_available=docker_available,
            docker_error=docker_error,
            overall_status=overall_status,
            checked_at=checked_at,
            control_db_status=control_db_status,
            control_db_detail=control_db_detail,
            active_data_db_status=active_data_db_status,
            active_data_db_detail=active_data_db_detail,
            recent_error_count=len(recent_errors),
            services=services,
            db_connections=db_connections,
            recommended_actions=recommended_actions,
            installed_versions=installed_versions,
            latest_snapshot=serialize_runtime_snapshot(latest_snapshot_entry) if latest_snapshot_entry else None,
        )


def record_runtime_health_snapshot() -> Optional[RuntimeHealthSnapshot]:
    try:
        overview = compute_runtime_overview()
        details = {
            "checked_at": overview.checked_at.isoformat(),
            "control_db_detail": overview.control_db_detail,
            "active_data_db_detail": overview.active_data_db_detail,
            "db_connections": [item.model_dump() for item in overview.db_connections],
            "services": [item.model_dump() for item in overview.services],
            "docker_error": overview.docker_error,
        }
        with Session(control_engine) as session:
            snapshot = RuntimeHealthSnapshot(
                overall_status=overview.overall_status,
                control_db_status=overview.control_db_status,
                active_data_db_status=overview.active_data_db_status,
                docker_status="ok" if overview.docker_available else ("degraded" if overview.docker_error else "unknown"),
                error_count_last_hour=overview.recent_error_count,
                details_json=json.dumps(details),
            )
            session.add(snapshot)
            session.commit()
            session.refresh(snapshot)
            snapshots = session.exec(select(RuntimeHealthSnapshot).order_by(RuntimeHealthSnapshot.occurred_at.desc(), RuntimeHealthSnapshot.id.desc())).all()
            for stale in snapshots[500:]:
                session.delete(stale)
            session.commit()
            return snapshot
    except Exception:
        return None


def start_health_probe_loop() -> None:
    global health_probe_thread_started
    if health_probe_thread_started:
        return
    health_probe_thread_started = True

    def worker() -> None:
        while True:
            record_runtime_health_snapshot()
            time.sleep(max(15, HEALTH_PROBE_INTERVAL_SECONDS))

    threading.Thread(target=worker, name="matrixmanager-health-probe", daemon=True).start()


def get_runtime_overview() -> RuntimeOverviewRead:
    return compute_runtime_overview()


def record_audit_entry(
    session: Session,
    *,
    actor_username: str,
    entity_type: str,
    action: str,
    entity_id: Optional[int] = None,
    entity_label: Optional[str] = None,
    before: Optional[dict[str, Any]] = None,
    after: Optional[dict[str, Any]] = None,
) -> AuditEntry:
    entry = AuditEntry(
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        action=action,
        actor_username=actor_username,
        before_json=dump_audit_json(before),
        after_json=dump_audit_json(after),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


BASE_NAV_MARKUP = """<nav>
        <a href="/planning">Projects</a>
        <a href="/people">Employees</a>
        <a href="/staffing">Assignments</a>
        <a href="/orgs">Organizations</a>
        <a href="/canvas">Canvas</a>
        <a href="/dashboard">Forecast</a>
        <form method="post" action="/logout" class="logout-form">
          <button type="submit" class="logout-button">Logout</button>
        </form>
      </nav>"""


def build_header_brand(subtitle: str = "") -> str:
    logo_url = static_asset_url("images/matrix-manager-favicon.svg")
    subtitle_markup = f'<p class="header-brand-subtitle">{subtitle}</p>' if subtitle else ""
    return f'''<a href="/" class="header-brand" aria-label="Matrix Manager home">
        <img src="{logo_url}" alt="Matrix Manager" class="header-brand-logo" />
        <div class="header-brand-copy">
          <span class="header-brand-title">Matrix Management</span>
          {subtitle_markup}
        </div>
      </a>'''


def serve_html_page(
    filename: str,
    replacements: Optional[dict[str, str]] = None,
    current_path: Optional[str] = None,
    username: Optional[str] = None,
) -> str:
    html = (STATIC_DIR / filename).read_text(encoding="utf-8")
    replacements = replacements or {}
    favicon_markup = f'<link rel="icon" href="{static_asset_url("images/matrix-manager-favicon.ico")}" sizes="any" />'
    if "</head>" in html and favicon_markup not in html:
        html = html.replace("</head>", f"    {favicon_markup}\n  </head>", 1)
    if "<header>" in html and '<a href="/" class="header-brand"' not in html:
        subtitle_match = re.search(r"<header>\s*<div>\s*<h1>.*?</h1>\s*<p>(.*?)</p>\s*</div>", html, re.DOTALL)
        subtitle = subtitle_match.group(1).strip() if subtitle_match else ""
        brand_markup = build_header_brand(subtitle)
        html = re.sub(
            r"<header>\s*<div>\s*<h1>.*?</h1>\s*<p>.*?</p>\s*</div>",
            f'<header class="app-header">\n      {brand_markup}',
            html,
            count=1,
            flags=re.DOTALL,
        )
    if current_path and username:
        replacements[BASE_NAV_MARKUP] = render_app_nav(current_path=current_path, username=username)
        footer_markup = '    <footer class="app-footer">Created by Daymian</footer>\n'
        replacements["</body>"] = f'{footer_markup}    <script src="{static_asset_url("app-shell.js")}"></script>\n  </body>'
    for old, new in replacements.items():
        html = html.replace(old, new)
    return html


@app.on_event("startup")
def on_startup() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONTROL_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    create_db_and_tables(control_engine)
    run_migrations(control_engine)
    ensure_default_db_connection()
    ensure_default_admin_user()
    active_connection = get_active_db_connection_config()
    get_or_create_data_engine(active_connection)
    record_runtime_health_snapshot()
    start_health_probe_loop()


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def require_login(request: Request, call_next):
    public_paths = {"/login", "/health"}
    if request.url.path in public_paths:
        return await call_next(request)
    if request.url.path.startswith("/static/"):
        return await call_next(request)
    if verify_session_value(request.cookies.get(SESSION_COOKIE_NAME)):
        return await call_next(request)
    if is_html_request(request):
        return RedirectResponse(url=f"/login?next={quote(str(request.url.path))}", status_code=302)
    raise HTTPException(status_code=401, detail="Authentication required")


@app.middleware("http")
async def capture_runtime_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except HTTPException:
        raise
    except Exception as exc:
        record_runtime_error(exc, request)
        raise


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "install_mode": MATRIX_INSTALL_MODE,
        "active_db_type": MATRIX_ACTIVE_DB_TYPE,
    }


@app.get("/health/ready")
def health_ready():
    overview = compute_runtime_overview()
    return {
        "ok": overview.overall_status == "ok",
        "status": overview.overall_status,
        "checked_at": overview.checked_at.isoformat(),
        "control_db": {"status": overview.control_db_status, "detail": overview.control_db_detail},
        "active_data_db": {"status": overview.active_data_db_status, "detail": overview.active_data_db_detail},
        "docker": {"available": overview.docker_available, "error": overview.docker_error},
        "recent_error_count": overview.recent_error_count,
    }


@app.get("/health/details", response_model=RuntimeOverviewRead)
def health_details(request: Request):
    require_admin_user(request)
    return compute_runtime_overview()


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request, error: str = "", next: str = "/") -> str:
    if verify_session_value(request.cookies.get(SESSION_COOKIE_NAME)):
        return RedirectResponse(url="/", status_code=302)
    return build_login_page(error=error, next_path=next)


def ensure_default_admin_user() -> None:
    with Session(control_engine) as session:
        env_admin = session.exec(select(UserAccount).where(UserAccount.username == get_auth_username())).first()
        if env_admin:
            return
        session.add(
            UserAccount(
                username=get_auth_username(),
                password_hash=hash_password(get_auth_password()),
                is_admin=True,
                is_active=True,
            )
        )
        session.commit()


def ensure_inbox_welcome_notification(username: str) -> None:
    with Session(control_engine) as session:
        existing = session.exec(select(InboxNotification).where(InboxNotification.username == username)).first()
        if existing:
            return
        session.add(
            InboxNotification(
                username=username,
                title="Welcome to Matrix Management",
                message="This inbox is where user-specific notifications will appear. You can reach it any time from the signed-in account menu.",
            )
        )
        session.commit()


def get_assignment_review_state(metadata: Optional[dict[str, Any]]) -> tuple[bool, Optional[str]]:
    if not metadata or metadata.get("kind") != "assignment_review":
        return False, None
    assignment_id = metadata.get("assignment_id")
    if not assignment_id:
        return False, None
    active_connection = get_active_db_connection_config()
    data_engine = get_or_create_data_engine(active_connection)
    with Session(data_engine) as data_session:
        assignment = data_session.get(Assignment, assignment_id)
        if not assignment:
            return False, None
        return assignment.status == "in_review", assignment.status


def serialize_inbox_notification(notification: InboxNotification) -> InboxNotificationRead:
    metadata = json.loads(notification.metadata_json) if notification.metadata_json else None
    is_actionable, review_status = get_assignment_review_state(metadata)
    if metadata and metadata.get("kind") == "assignment_review":
        metadata = {**metadata, "is_actionable": is_actionable, "review_status": review_status}
    return InboxNotificationRead(
        id=notification.id,
        username=notification.username,
        title=notification.title,
        message=notification.message,
        payload=metadata,
        is_actionable=is_actionable,
        is_read=notification.is_read,
        created_at=notification.created_at,
    )


def add_inbox_notification(session: Session, *, username: str, title: str, message: str, metadata: Optional[dict[str, Any]] = None) -> InboxNotification:
    notification = InboxNotification(
        username=username,
        title=title,
        message=message,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return notification


def retire_assignment_review_notifications(session: Session, assignment_id: int) -> None:
    notifications = session.exec(select(InboxNotification).where(InboxNotification.metadata_json.is_not(None))).all()
    updated = False
    for notification in notifications:
        metadata = json.loads(notification.metadata_json) if notification.metadata_json else None
        if metadata and metadata.get("kind") == "assignment_review" and metadata.get("assignment_id") == assignment_id:
            if not notification.is_read:
                notification.is_read = True
                session.add(notification)
                updated = True
    if updated:
        session.commit()


def ensure_assignment_review_notifications(assignment: Assignment, *, control_session: Optional[Session] = None) -> list[str]:
    if assignment.status != "in_review":
        return []
    owned_session = control_session is None
    session = control_session or Session(control_engine)
    try:
        active_connection = get_active_db_connection_config()
        data_engine = get_or_create_data_engine(active_connection)
        with Session(data_engine) as data_session:
            assignment_read = serialize_assignment(data_session, assignment)
        approver_usernames = get_management_chain_usernames(assignment.employee_id)
        metadata = {
            "kind": "assignment_review",
            "assignment_id": assignment.id,
            "employee_name": assignment_read.employee_name,
            "project_name": assignment_read.project_name,
            "submitter_username": assignment.submitted_by_username,
        }
        existing_items = session.exec(select(InboxNotification).where(InboxNotification.metadata_json.is_not(None))).all()
        existing_usernames = {
            item.username
            for item in existing_items
            if ((json.loads(item.metadata_json) if item.metadata_json else {}).get("kind") == "assignment_review")
            and ((json.loads(item.metadata_json) if item.metadata_json else {}).get("assignment_id") == assignment.id)
        }
        created_for: list[str] = []
        for approver_username in approver_usernames:
            if approver_username in existing_usernames:
                continue
            add_inbox_notification(
                session,
                username=approver_username,
                title="Assignment request awaiting review",
                message=f"{assignment.submitted_by_username or 'Someone'} submitted {assignment_read.employee_name or assignment.employee_id} → {assignment_read.project_name or assignment.project_id} for review.",
                metadata=metadata,
            )
            created_for.append(approver_username)
        return created_for
    finally:
        if owned_session:
            session.close()


def refresh_assignment_reviews_for_employee_link(employee_id: Optional[int], *, control_session: Optional[Session] = None) -> list[int]:
    if employee_id is None:
        return []
    active_connection = get_active_db_connection_config()
    data_engine = get_or_create_data_engine(active_connection)
    refreshed: list[int] = []
    with Session(data_engine) as data_session:
        pending_assignments = data_session.exec(select(Assignment).where(Assignment.status == "in_review")).all()
        for assignment in pending_assignments:
            chain = get_management_chain_usernames(assignment.employee_id)
            user = control_session.exec(select(UserAccount).where(UserAccount.employee_id == employee_id, UserAccount.is_active == True)).first() if control_session else None
            target_username = user.username if user else None
            if target_username and target_username in chain:
                created = ensure_assignment_review_notifications(assignment, control_session=control_session)
                if created:
                    refreshed.append(assignment.id)
    return refreshed


def get_user_account(username: str) -> Optional[UserAccount]:
    with Session(control_engine) as session:
        return session.exec(select(UserAccount).where(UserAccount.username == username)).first()


def get_management_chain_usernames(employee_id: int) -> list[str]:
    active_connection = get_active_db_connection_config()
    data_engine = get_or_create_data_engine(active_connection)
    with Session(data_engine) as data_session, Session(control_engine) as control_session:
        chain_usernames: list[str] = []
        seen: set[int] = set()
        current = data_session.get(Employee, employee_id)
        while current and current.manager_id and current.manager_id not in seen:
            seen.add(current.manager_id)
            manager = data_session.get(Employee, current.manager_id)
            if not manager:
                break
            user = control_session.exec(select(UserAccount).where(UserAccount.employee_id == manager.id, UserAccount.is_active == True)).first()
            if user and user.username not in chain_usernames:
                chain_usernames.append(user.username)
            current = manager
        return chain_usernames


def can_review_assignment(username: str, assignment: Assignment) -> bool:
    if is_admin_username(username):
        return True
    user = get_user_account(username)
    if not user or user.employee_id is None:
        return False
    chain_ids: set[int] = set()
    active_connection = get_active_db_connection_config()
    data_engine = get_or_create_data_engine(active_connection)
    with Session(data_engine) as data_session:
        current = data_session.get(Employee, assignment.employee_id)
        while current and current.manager_id and current.manager_id not in chain_ids:
            chain_ids.add(current.manager_id)
            current = data_session.get(Employee, current.manager_id)
    return user.employee_id in chain_ids


def ensure_default_seed_data() -> None:
    active_connection = get_active_db_connection_config()
    data_engine = get_or_create_data_engine(active_connection)
    start_date = datetime.now().date()
    end_date = date(start_date.year + ((start_date.month + 5) // 12), ((start_date.month + 5) % 12) + 1, min(start_date.day, 28))
    review_end_date = date(start_date.year, start_date.month, min(start_date.day + 27, 28))
    with Session(data_engine) as session, Session(control_engine) as control_session:
        not_assigned = session.exec(select(JobCode).where(JobCode.name == "Not Assigned")).first()
        if not not_assigned:
            not_assigned = JobCode(name="Not Assigned", is_leader=False)
            session.add(not_assigned)
            session.commit()
            session.refresh(not_assigned)

        manager_code = session.exec(select(JobCode).where(JobCode.name == "Manager")).first()
        if not manager_code:
            manager_code = JobCode(name="Manager", is_leader=True)
            session.add(manager_code)
            session.commit()
            session.refresh(manager_code)

        engineer_code = session.exec(select(JobCode).where(JobCode.name == "Software Engineer")) .first()
        if not engineer_code:
            engineer_code = JobCode(name="Software Engineer", is_leader=False)
            session.add(engineer_code)
            session.commit()
            session.refresh(engineer_code)

        get_or_create_unassigned_organization(session)

        default_org = session.exec(select(Organization).where(Organization.name == "Default Org")).first()
        if not default_org:
            default_org = Organization(name="Default Org", description="Default starter organization")
            session.add(default_org)
            session.commit()
            session.refresh(default_org)

        example_project = session.exec(select(Project).where(Project.name == "Example Project")).first()
        if not example_project:
            example_project = Project(
                name="Example Project",
                description="Starter project created during install",
                start_date=start_date,
                end_date=end_date,
            )
            session.add(example_project)
            session.commit()
            session.refresh(example_project)
        else:
            example_project.description = "Starter project created during install"
            example_project.start_date = start_date
            example_project.end_date = end_date
            session.add(example_project)
            session.commit()
            session.refresh(example_project)

        jane = session.exec(select(Employee).where(Employee.name == "Jane Doe")).first()
        if not jane:
            jane_payload = validate_employee_payload(
                session,
                {
                    "name": "Jane Doe",
                    "job_code_id": manager_code.id,
                    "organization_id": default_org.id,
                    "manager_id": None,
                    "location": "HQ",
                    "capacity": 1.0,
                },
            )
            jane = Employee(**jane_payload)
            session.add(jane)
            session.commit()
            session.refresh(jane)
        else:
            jane.job_code_id = manager_code.id
            jane.organization_id = default_org.id
            jane.location = "HQ"
            jane.employee_type = "L"
            session.add(jane)
            session.commit()
            session.refresh(jane)

        john = session.exec(select(Employee).where(Employee.name == "John Doe")).first()
        if not john:
            john_payload = validate_employee_payload(
                session,
                {
                    "name": "John Doe",
                    "job_code_id": engineer_code.id,
                    "organization_id": default_org.id,
                    "manager_id": jane.id,
                    "location": "Remote",
                    "capacity": 1.0,
                },
            )
            john = Employee(**john_payload)
            session.add(john)
            session.commit()
            session.refresh(john)
        else:
            john.job_code_id = engineer_code.id
            john.organization_id = default_org.id
            john.manager_id = jane.id
            john.location = "Remote"
            john.employee_type = "IC"
            session.add(john)
            session.commit()
            session.refresh(john)

        example_demand = session.exec(
            select(Demand).where(Demand.project_id == example_project.id, Demand.title == "Example Project Staffing Need")
        ).first()
        if not example_demand:
            example_demand = Demand(
                project_id=example_project.id,
                title="Example Project Staffing Need",
                organization_id=default_org.id,
                job_code_id=engineer_code.id,
                skill_notes="Backend API and staffing workflow",
                start_date=start_date,
                end_date=end_date,
                required_allocation=1.5,
                notes="Starter demand used to demonstrate approvals and forecast coverage",
            )
            session.add(example_demand)
            session.commit()
            session.refresh(example_demand)
        else:
            example_demand.organization_id = default_org.id
            example_demand.job_code_id = engineer_code.id
            example_demand.skill_notes = "Backend API and staffing workflow"
            example_demand.start_date = start_date
            example_demand.end_date = end_date
            example_demand.required_allocation = 1.5
            example_demand.notes = "Starter demand used to demonstrate approvals and forecast coverage"
            session.add(example_demand)
            session.commit()
            session.refresh(example_demand)

        approved_assignment = session.exec(
            select(Assignment).where(Assignment.employee_id == john.id, Assignment.project_id == example_project.id, Assignment.status == "approved")
        ).first()
        if not approved_assignment:
            approved_assignment = Assignment(
                employee_id=john.id,
                project_id=example_project.id,
                demand_id=example_demand.id,
                start_date=start_date,
                end_date=end_date,
                allocation=0.75,
                notes="Starter approved example allocation",
                status="approved",
                submitted_by_username="betauser",
                approved_by_username=get_auth_username(),
                reviewed_at=datetime.now(timezone.utc),
            )
        else:
            approved_assignment.employee_id = john.id
            approved_assignment.project_id = example_project.id
            approved_assignment.demand_id = example_demand.id
            approved_assignment.start_date = start_date
            approved_assignment.end_date = end_date
            approved_assignment.allocation = 0.75
            approved_assignment.notes = "Starter approved example allocation"
            approved_assignment.status = "approved"
            approved_assignment.submitted_by_username = "betauser"
            approved_assignment.approved_by_username = get_auth_username()
            approved_assignment.denied_by_username = None
            approved_assignment.reviewed_at = datetime.now(timezone.utc)
        session.add(approved_assignment)
        session.commit()
        session.refresh(approved_assignment)

        pending_assignment = session.exec(
            select(Assignment).where(Assignment.employee_id == john.id, Assignment.project_id == example_project.id, Assignment.status == "in_review")
        ).first()
        if not pending_assignment:
            pending_assignment = Assignment(
                employee_id=john.id,
                project_id=example_project.id,
                demand_id=example_demand.id,
                start_date=start_date,
                end_date=review_end_date,
                allocation=0.5,
                notes="Starter assignment request awaiting approval",
                status="in_review",
                submitted_by_username="betauser",
            )
        else:
            pending_assignment.employee_id = john.id
            pending_assignment.project_id = example_project.id
            pending_assignment.demand_id = example_demand.id
            pending_assignment.start_date = start_date
            pending_assignment.end_date = review_end_date
            pending_assignment.allocation = 0.5
            pending_assignment.notes = "Starter assignment request awaiting approval"
            pending_assignment.status = "in_review"
            pending_assignment.submitted_by_username = "betauser"
            pending_assignment.approved_by_username = None
            pending_assignment.denied_by_username = None
            pending_assignment.reviewed_at = None
        session.add(pending_assignment)
        session.commit()
        session.refresh(pending_assignment)

        admin_user = control_session.exec(select(UserAccount).where(UserAccount.username == get_auth_username())).first()
        if admin_user:
            admin_user.employee_id = jane.id
            admin_user.is_admin = True
            admin_user.is_active = True
            admin_user.updated_at = datetime.now(timezone.utc)
            control_session.add(admin_user)

        requester_user = control_session.exec(select(UserAccount).where(UserAccount.username == "betauser")).first()
        if not requester_user:
            requester_user = UserAccount(
                username="betauser",
                password_hash=hash_password("superlongpw"),
                employee_id=john.id,
                is_admin=False,
                is_active=True,
            )
        else:
            requester_user.employee_id = john.id
            requester_user.is_active = True
        control_session.add(requester_user)
        control_session.commit()
        ensure_inbox_welcome_notification(get_auth_username())
        ensure_inbox_welcome_notification("betauser")
        refresh_assignment_reviews_for_employee_link(jane.id, control_session=control_session)
        ensure_assignment_review_notifications(pending_assignment, control_session=control_session)


@app.post("/seed-default-data")
def seed_default_data(request: Request):
    require_admin_user(request)
    ensure_default_seed_data()
    return {"status": "ok"}


@app.post("/login")
async def login_submit(request: Request):
    raw_body = (await request.body()).decode("utf-8")
    fields = {}
    for pair in raw_body.split("&"):
        if not pair:
            continue
        key, _, value = pair.partition("=")
        fields[key] = value.replace("+", " ")
    username = fields.get("username", "")
    password = fields.get("password", "")
    next_target = fields.get("next", "/")
    from urllib.parse import unquote_plus
    username = unquote_plus(username)
    password = unquote_plus(password)
    next_target = unquote_plus(next_target)
    if not authenticate_username_password(username, password):
        return HTMLResponse(build_login_page(error="Invalid username or password.", next_path=next_target), status_code=401)
    ensure_inbox_welcome_notification(username)
    target = next_target if next_target.startswith("/") else "/"
    response = RedirectResponse(url=target, status_code=302)
    response.set_cookie(
        SESSION_COOKIE_NAME,
        sign_session_value(username),
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return response


@app.post("/logout")
def logout():
    response = RedirectResponse(url="/login", status_code=302)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return response


@app.get("/", response_class=HTMLResponse)
def serve_home(request: Request) -> str:
    return serve_html_page(
        "home.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
        },
        current_path=request.url.path,
        username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)),
    )


@app.get("/planning", response_class=HTMLResponse)
def serve_index(request: Request) -> str:
    return serve_html_page(
        "planning.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/planning.js"': f'src="{static_asset_url("planning.js")}"',
        },
        current_path=request.url.path,
        username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)),
    )


@app.get("/demands", response_class=HTMLResponse)
def serve_demands(request: Request) -> str:
    return serve_html_page(
        "demands.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/demands.js"': f'src="{static_asset_url("demands.js")}"',
        },
        current_path=request.url.path,
        username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)),
    )


@app.get("/people", response_class=HTMLResponse)
def serve_employees(request: Request) -> str:
    return serve_html_page(
        "employees.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/employees.js"': f'src="{static_asset_url("employees.js")}"',
        },
        current_path=request.url.path,
        username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)),
    )


@app.get("/staffing", response_class=HTMLResponse)
def serve_assignments(request: Request) -> str:
    return serve_html_page(
        "assignments.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/assignments.js"': f'src="{static_asset_url("assignments.js")}"',
        },
        current_path=request.url.path,
        username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)),
    )


@app.get("/canvas", response_class=HTMLResponse)
def serve_canvas(request: Request) -> str:
    return serve_html_page(
        "canvas.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/canvas.js"': f'src="{static_asset_url("canvas.js")}"',
        },
        current_path=request.url.path,
        username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)),
    )


@app.get("/dashboard", response_class=HTMLResponse)
def serve_dashboard(request: Request) -> str:
    return serve_html_page(
        "project-dashboard.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/project-dashboard.js"': f'src="{static_asset_url("project-dashboard.js")}"',
        },
        current_path=request.url.path,
        username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)),
    )


@app.get("/inbox", response_class=HTMLResponse)
def serve_inbox(request: Request) -> str:
    return serve_html_page(
        "inbox.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/inbox.js"': f'src="{static_asset_url("inbox.js")}"',
        },
        current_path=request.url.path,
        username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)),
    )


@app.get("/account-settings", response_class=HTMLResponse)
def serve_account_settings_page(request: Request) -> str:
    return serve_html_page(
        "account-settings.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/account-settings.js"': f'src="{static_asset_url("account-settings.js")}"',
        },
        current_path=request.url.path,
        username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)),
    )


@app.get("/orgs", response_class=HTMLResponse)
def serve_org_manager(request: Request) -> str:
    return serve_html_page(
        "organizations.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/organizations.js"': f'src="{static_asset_url("organizations.js")}"',
        },
        current_path=request.url.path,
        username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)),
    )


@app.get("/job-codes", response_class=HTMLResponse)
def serve_job_codes(request: Request) -> str:
    return serve_html_page(
        "job-codes.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/job-codes.js"': f'src="{static_asset_url("job-codes.js")}"',
        },
        current_path=request.url.path,
        username=get_session_username(request.cookies.get(SESSION_COOKIE_NAME)),
    )


@app.get("/audit", response_class=HTMLResponse)
def serve_audit_page(request: Request) -> str:
    username = get_session_username(request.cookies.get(SESSION_COOKIE_NAME))
    return serve_html_page(
        "audit.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/audit.js"': f'src="{static_asset_url("audit.js")}"',
            'data-is-admin="false"': f'data-is-admin="{"true" if is_admin_username(username) else "false"}"',
            'data-current-user=""': f'data-current-user="{username or ""}"',
        },
        current_path=request.url.path,
        username=username,
    )


@app.get("/users", response_class=HTMLResponse)
def serve_users_page(request: Request) -> str:
    username = get_session_username(request.cookies.get(SESSION_COOKIE_NAME))
    if not is_admin_username(username):
        raise HTTPException(status_code=403, detail="Only admin can manage users")
    return serve_html_page(
        "users.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/users.js"': f'src="{static_asset_url("users.js")}"',
        },
        current_path=request.url.path,
        username=username,
    )


@app.get("/db-management", response_class=HTMLResponse)
def serve_db_management_page(request: Request) -> str:
    username = get_session_username(request.cookies.get(SESSION_COOKIE_NAME))
    if not is_admin_username(username):
        raise HTTPException(status_code=403, detail="Only admin can manage database connections")
    return serve_html_page(
        "db-management.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/db-management.js"': f'src="{static_asset_url("db-management.js")}"',
        },
        current_path=request.url.path,
        username=username,
    )


@app.get("/runtime", response_class=HTMLResponse)
def serve_runtime_page(request: Request) -> str:
    username = get_session_username(request.cookies.get(SESSION_COOKIE_NAME))
    if not is_admin_username(username):
        raise HTTPException(status_code=403, detail="Only admin can view runtime status")
    return serve_html_page(
        "runtime.html",
        {
            'href="/static/styles.css"': f'href="{static_asset_url("styles.css")}"',
            'src="/static/runtime.js"': f'src="{static_asset_url("runtime.js")}"',
        },
        current_path=request.url.path,
        username=username,
    )


@app.get("/job-codes-api", response_model=List[JobCodeRead])
def list_job_codes(session: Session = Depends(get_session)):
    return session.exec(select(JobCode).order_by(JobCode.name)).all()


@app.post("/job-codes-api", response_model=JobCodeRead, status_code=201)
def create_job_code(job_code: JobCodeCreate, request: Request, session: Session = Depends(get_session)):
    normalized_name = job_code.name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Job code name is required")
    existing = session.exec(select(JobCode).where(JobCode.name == normalized_name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Job code name must be unique")
    db_job_code = JobCode(name=normalized_name, is_leader=job_code.is_leader)
    session.add(db_job_code)
    session.commit()
    session.refresh(db_job_code)
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="job_code",
        action="create",
        entity_id=db_job_code.id,
        entity_label=db_job_code.name,
        after=audit_snapshot_from_model(db_job_code),
    )
    return db_job_code


@app.put("/job-codes-api/{job_code_id}", response_model=JobCodeRead)
def update_job_code(job_code_id: int, update: JobCodeUpdate, request: Request, session: Session = Depends(get_session)):
    job_code = session.get(JobCode, job_code_id)
    if not job_code:
        raise HTTPException(status_code=404, detail="Job code not found")
    before = audit_snapshot_from_model(job_code)
    update_data = update.dict(exclude_unset=True)
    if "name" in update_data:
        normalized_name = (update_data.get("name") or "").strip()
        if not normalized_name:
            raise HTTPException(status_code=400, detail="Job code name is required")
        existing = session.exec(select(JobCode).where(JobCode.name == normalized_name, JobCode.id != job_code_id)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Job code name must be unique")
        update_data["name"] = normalized_name
    if update_data.get("is_leader") is False:
        assigned_leader = session.exec(select(Employee).where(Employee.job_code_id == job_code_id, Employee.manager_id.is_not(None))).first()
        if assigned_leader:
            raise HTTPException(status_code=400, detail="Cannot mark this job code non-leader while assigned employees still need managers")
        employees_with_reports = session.exec(select(Employee).where(Employee.job_code_id == job_code_id)).all()
        for employee in employees_with_reports:
            if session.exec(select(Employee).where(Employee.manager_id == employee.id)).first():
                raise HTTPException(status_code=400, detail="Employees with direct reports must remain assigned to a leader job code")
    for key, value in update_data.items():
        setattr(job_code, key, value)
    session.add(job_code)
    session.commit()
    session.refresh(job_code)
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="job_code",
        action="update",
        entity_id=job_code.id,
        entity_label=job_code.name,
        before=before,
        after=audit_snapshot_from_model(job_code),
    )
    return job_code


@app.delete("/job-codes-api/{job_code_id}", status_code=204)
def delete_job_code(job_code_id: int, request: Request, session: Session = Depends(get_session)):
    job_code = session.get(JobCode, job_code_id)
    if not job_code:
        raise HTTPException(status_code=404, detail="Job code not found")
    if session.exec(select(Employee).where(Employee.job_code_id == job_code_id)).first():
        raise HTTPException(status_code=400, detail="Cannot delete a job code that is assigned to employees")
    before = audit_snapshot_from_model(job_code)
    label = job_code.name
    session.delete(job_code)
    session.commit()
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="job_code",
        action="delete",
        entity_id=job_code_id,
        entity_label=label,
        before=before,
    )


@app.get("/organizations", response_model=List[OrganizationRead])
def list_organizations(session: Session = Depends(get_session)):
    organizations = session.exec(select(Organization).order_by(Organization.name)).all()
    return [serialize_organization(session, organization) for organization in organizations]


@app.post("/organizations", response_model=OrganizationRead, status_code=201)
def create_organization(organization: OrganizationCreate, request: Request, session: Session = Depends(get_session)):
    payload = validate_organization_payload(session, organization.dict())
    db_org = Organization(**payload)
    session.add(db_org)
    session.commit()
    session.refresh(db_org)
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="organization",
        action="create",
        entity_id=db_org.id,
        entity_label=db_org.name,
        after=audit_snapshot_from_model(db_org),
    )
    return serialize_organization(session, db_org)


@app.put("/organizations/{organization_id}", response_model=OrganizationRead)
def update_organization(organization_id: int, update: OrganizationUpdate, request: Request, session: Session = Depends(get_session)):
    organization = session.get(Organization, organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")
    before = audit_snapshot_from_model(organization)
    payload = organization.dict()
    payload.update(update.dict(exclude_unset=True))
    validated = validate_organization_payload(session, payload, organization_id=organization_id)
    for key, value in validated.items():
        setattr(organization, key, value)
    session.add(organization)
    session.commit()
    session.refresh(organization)
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="organization",
        action="update",
        entity_id=organization.id,
        entity_label=organization.name,
        before=before,
        after=audit_snapshot_from_model(organization),
    )
    return serialize_organization(session, organization)


@app.delete("/organizations/{organization_id}", status_code=204)
def delete_organization(organization_id: int, request: Request, session: Session = Depends(get_session)):
    organization = session.get(Organization, organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")
    employee_count = session.exec(select(Employee).where(Employee.organization_id == organization_id)).first()
    if employee_count:
        raise HTTPException(status_code=400, detail="Cannot delete organization with assigned employees")
    child_organization = session.exec(select(Organization).where(Organization.parent_organization_id == organization_id)).first()
    if child_organization:
        raise HTTPException(status_code=400, detail="Cannot delete organization with child organizations")
    before = audit_snapshot_from_model(organization)
    label = organization.name
    session.delete(organization)
    session.commit()
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="organization",
        action="delete",
        entity_id=organization_id,
        entity_label=label,
        before=before,
    )


@app.get("/employees", response_model=List[EmployeeRead])
def list_employees(session: Session = Depends(get_session)):
    employees = session.exec(select(Employee).order_by(Employee.name)).all()
    return [serialize_employee(session, emp) for emp in employees]


@app.post("/employees", response_model=EmployeeRead, status_code=201)
def create_employee(employee: EmployeeCreate, request: Request, session: Session = Depends(get_session)):
    employee_payload = validate_employee_payload(session, employee.dict())
    db_employee = Employee(**employee_payload)
    session.add(db_employee)
    session.commit()
    session.refresh(db_employee)
    employee_read = serialize_employee(session, db_employee)
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="employee",
        action="create",
        entity_id=db_employee.id,
        entity_label=db_employee.name,
        after=audit_snapshot_from_model(employee_read),
    )
    return employee_read


@app.get("/employees/{employee_id}", response_model=EmployeeRead)
def get_employee(employee_id: int, session: Session = Depends(get_session)):
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return serialize_employee(session, employee)


@app.put("/employees/{employee_id}", response_model=EmployeeRead)
def update_employee(employee_id: int, update: EmployeeUpdate, request: Request, session: Session = Depends(get_session)):
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    before = audit_snapshot_from_model(serialize_employee(session, employee))
    employee_data = update.dict(exclude_unset=True)
    proposed_employee = {
        "name": employee_data.get("name", employee.name),
        "job_code_id": employee_data.get("job_code_id", employee.job_code_id),
        "employee_type": employee_data.get("employee_type", employee.employee_type),
        "location": employee_data.get("location", employee.location),
        "capacity": employee_data.get("capacity", employee.capacity),
        "organization_id": employee_data.get("organization_id", employee.organization_id),
        "manager_id": employee_data.get("manager_id", employee.manager_id),
        "employee_id": employee_id,
    }

    validated_employee = validate_employee_payload(session, proposed_employee)
    for key, value in employee_data.items():
        setattr(employee, key, value)
    employee.employee_type = validated_employee["employee_type"]
    session.add(employee)
    session.commit()
    session.refresh(employee)
    employee_read = serialize_employee(session, employee)
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="employee",
        action="update",
        entity_id=employee.id,
        entity_label=employee.name,
        before=before,
        after=audit_snapshot_from_model(employee_read),
    )
    return employee_read


@app.delete("/employees/{employee_id}", status_code=204)
def delete_employee(employee_id: int, request: Request, session: Session = Depends(get_session)):
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    actor_username = get_request_username(request)
    before = audit_snapshot_from_model(serialize_employee(session, employee))
    label = employee.name
    assignments = session.exec(select(Assignment).where(Assignment.employee_id == employee_id)).all()
    for assignment in assignments:
        assignment_before = serialize_assignment(session, assignment)
        assignment_label = f"{assignment_before.employee_name or assignment.employee_id} → {assignment_before.project_name or assignment.project_id}"
        session.delete(assignment)
        session.commit()
        record_audit_entry(
            session,
            actor_username=actor_username,
            entity_type="assignment",
            action="delete",
            entity_id=assignment.id,
            entity_label=assignment_label,
            before=audit_snapshot_from_model(assignment_before),
        )
    direct_reports = session.exec(select(Employee).where(Employee.manager_id == employee_id)).all()
    for report in direct_reports:
        report_before = audit_snapshot_from_model(serialize_employee(session, report))
        report.manager_id = None
        session.add(report)
        session.commit()
        session.refresh(report)
        record_audit_entry(
            session,
            actor_username=actor_username,
            entity_type="employee",
            action="update",
            entity_id=report.id,
            entity_label=report.name,
            before=report_before,
            after=audit_snapshot_from_model(serialize_employee(session, report)),
        )
    session.delete(employee)
    session.commit()
    record_audit_entry(
        session,
        actor_username=actor_username,
        entity_type="employee",
        action="delete",
        entity_id=employee_id,
        entity_label=label,
        before=before,
    )


@app.get("/demands-api", response_model=List[DemandRead])
def list_demands(session: Session = Depends(get_session)):
    demands = session.exec(select(Demand).order_by(Demand.start_date, Demand.title)).all()
    return [serialize_demand(session, demand) for demand in demands]


@app.post("/demands-api", response_model=DemandRead, status_code=201)
def create_demand(demand: DemandCreate, request: Request, session: Session = Depends(get_session)):
    payload = validate_demand_payload(session, demand.model_dump())
    db_demand = Demand(**payload)
    session.add(db_demand)
    session.commit()
    session.refresh(db_demand)
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="demand",
        action="create",
        entity_id=db_demand.id,
        entity_label=db_demand.title,
        after=audit_snapshot_from_model(serialize_demand(session, db_demand)),
    )
    return serialize_demand(session, db_demand)


@app.put("/demands-api/{demand_id}", response_model=DemandRead)
def update_demand(demand_id: int, update: DemandUpdate, request: Request, session: Session = Depends(get_session)):
    demand = session.get(Demand, demand_id)
    if not demand:
        raise HTTPException(status_code=404, detail="Demand not found")
    before = audit_snapshot_from_model(serialize_demand(session, demand))
    data = update.model_dump(exclude_unset=True)
    proposed = {
        "project_id": data.get("project_id", demand.project_id),
        "title": data.get("title", demand.title),
        "organization_id": data.get("organization_id", demand.organization_id),
        "job_code_id": data.get("job_code_id", demand.job_code_id),
        "skill_notes": data.get("skill_notes", demand.skill_notes),
        "start_date": data.get("start_date", demand.start_date),
        "end_date": data.get("end_date", demand.end_date),
        "required_allocation": data.get("required_allocation", demand.required_allocation),
        "notes": data.get("notes", demand.notes),
    }
    validated = validate_demand_payload(session, proposed)
    for key, value in validated.items():
        setattr(demand, key, value)
    session.add(demand)
    session.commit()
    session.refresh(demand)
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="demand",
        action="update",
        entity_id=demand.id,
        entity_label=demand.title,
        before=before,
        after=audit_snapshot_from_model(serialize_demand(session, demand)),
    )
    return serialize_demand(session, demand)


@app.delete("/demands-api/{demand_id}", status_code=204)
def delete_demand(demand_id: int, request: Request, session: Session = Depends(get_session)):
    demand = session.get(Demand, demand_id)
    if not demand:
        raise HTTPException(status_code=404, detail="Demand not found")
    if session.exec(select(Assignment).where(Assignment.demand_id == demand_id)).first():
        raise HTTPException(status_code=400, detail="Cannot delete a demand that is fulfilled by assignments")
    before = audit_snapshot_from_model(serialize_demand(session, demand))
    label = demand.title
    session.delete(demand)
    session.commit()
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="demand",
        action="delete",
        entity_id=demand_id,
        entity_label=label,
        before=before,
    )


@app.get("/projects", response_model=List[ProjectRead])
def list_projects(session: Session = Depends(get_session)):
    projects = session.exec(select(Project).order_by(Project.name)).all()
    return projects


@app.post("/projects", response_model=ProjectRead, status_code=201)
def create_project(project: ProjectCreate, request: Request, session: Session = Depends(get_session)):
    validate_dates(project.start_date, project.end_date)
    db_project = Project.from_orm(project)
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="project",
        action="create",
        entity_id=db_project.id,
        entity_label=db_project.name,
        after=audit_snapshot_from_model(db_project),
    )
    return db_project


@app.get("/projects/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.put("/projects/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, update: ProjectUpdate, request: Request, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    before = audit_snapshot_from_model(project)
    validate_dates(update.start_date, project.end_date if update.end_date is None else update.end_date)
    project_data = update.dict(exclude_unset=True)
    for key, value in project_data.items():
        setattr(project, key, value)
    session.add(project)
    session.commit()
    session.refresh(project)
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="project",
        action="update",
        entity_id=project.id,
        entity_label=project.name,
        before=before,
        after=audit_snapshot_from_model(project),
    )
    return project


@app.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, request: Request, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    actor_username = get_request_username(request)
    before = audit_snapshot_from_model(project)
    label = project.name
    assignments = session.exec(select(Assignment).where(Assignment.project_id == project_id)).all()
    for assignment in assignments:
        assignment_before = serialize_assignment(session, assignment)
        assignment_label = f"{assignment_before.employee_name or assignment.employee_id} → {assignment_before.project_name or assignment.project_id}"
        session.delete(assignment)
        session.commit()
        record_audit_entry(
            session,
            actor_username=actor_username,
            entity_type="assignment",
            action="delete",
            entity_id=assignment.id,
            entity_label=assignment_label,
            before=audit_snapshot_from_model(assignment_before),
        )
    session.delete(project)
    session.commit()
    record_audit_entry(
        session,
        actor_username=actor_username,
        entity_type="project",
        action="delete",
        entity_id=project_id,
        entity_label=label,
        before=before,
    )


def validate_dates(start: Optional[date], end: Optional[date]) -> None:
    if start and end and end < start:
        raise HTTPException(status_code=400, detail="End date must be after start date")


def ensure_employee(session: Session, employee_id: int) -> Employee:
    employee = session.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


def ensure_project(session: Session, project_id: int) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def ensure_organization(session: Session, organization_id: int) -> Organization:
    organization = session.get(Organization, organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")
    return organization


def get_or_create_unassigned_organization(session: Session) -> Organization:
    organization = session.exec(select(Organization).where(Organization.name == "Unassigned")).first()
    if organization:
        return organization
    organization = Organization(name="Unassigned", description="Default catch-all organization bucket")
    session.add(organization)
    session.commit()
    session.refresh(organization)
    return organization


def ensure_job_code(session: Session, job_code_id: int) -> JobCode:
    job_code = session.get(JobCode, job_code_id)
    if not job_code:
        raise HTTPException(status_code=404, detail="Job code not found")
    return job_code


def ensure_project(session: Session, project_id: int) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def ensure_demand(session: Session, demand_id: int) -> Demand:
    demand = session.get(Demand, demand_id)
    if not demand:
        raise HTTPException(status_code=404, detail="Demand not found")
    return demand


def creates_organization_cycle(session: Session, organization_id: int, parent_organization_id: int) -> bool:
    seen: Set[int] = set()
    current_id: Optional[int] = parent_organization_id
    while current_id is not None:
        if current_id == organization_id:
            return True
        if current_id in seen:
            return True
        seen.add(current_id)
        current = session.get(Organization, current_id)
        if not current:
            return False
        current_id = current.parent_organization_id
    return False


def validate_organization_payload(session: Session, payload: dict[str, Any], *, organization_id: Optional[int] = None) -> dict[str, Any]:
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Organization name is required")
    payload["name"] = name
    payload["description"] = (payload.get("description") or "").strip() or None
    parent_organization_id = payload.get("parent_organization_id")
    owner_employee_id = payload.get("owner_employee_id")
    if parent_organization_id is not None:
        ensure_organization(session, parent_organization_id)
        if organization_id is not None and parent_organization_id == organization_id:
            raise HTTPException(status_code=400, detail="Organization cannot be its own parent")
        if organization_id is not None and creates_organization_cycle(session, organization_id, parent_organization_id):
            raise HTTPException(status_code=400, detail="Organization hierarchy creates a cycle")
    if owner_employee_id is not None:
        owner = ensure_employee(session, owner_employee_id)
        direct_report_exists = session.exec(select(Employee).where(Employee.manager_id == owner_employee_id)).first()
        if owner.employee_type != "L" and not direct_report_exists:
            raise HTTPException(status_code=400, detail="Organization owner must be a leader or manager")
    return payload


def validate_employee_type(employee_type: str) -> str:
    if employee_type not in {"IC", "L"}:
        raise HTTPException(status_code=400, detail="Employee type must be IC or L")
    return employee_type


def validate_employee_payload(session: Session, payload: dict) -> dict[str, Any]:
    capacity = payload.get("capacity")
    organization_id = payload.get("organization_id")
    manager_id = payload.get("manager_id")
    employee_id = payload.get("employee_id")
    job_code_id = payload.get("job_code_id")

    if capacity is None or capacity <= 0:
        raise HTTPException(status_code=400, detail="Capacity must be greater than zero")
    if organization_id is None:
        raise HTTPException(status_code=400, detail="Organization is required")
    if job_code_id is None:
        raise HTTPException(status_code=400, detail="Job code is required")
    ensure_organization(session, organization_id)
    job_code = ensure_job_code(session, job_code_id)
    normalized_type = "L" if job_code.is_leader else "IC"
    payload["employee_type"] = normalized_type
    if normalized_type == "IC" and manager_id is None:
        raise HTTPException(status_code=400, detail="Individual contributors must have a manager")
    if manager_id is not None:
        ensure_valid_manager(session, employee_id=employee_id, manager_id=manager_id)
    if employee_id is not None and normalized_type != "L":
        direct_report_exists = session.exec(select(Employee).where(Employee.manager_id == employee_id)).first()
        if direct_report_exists:
            raise HTTPException(status_code=400, detail="Employees with direct reports must remain assigned to a leader job code")
    return payload


def ensure_valid_manager(session: Session, employee_id: Optional[int], manager_id: int) -> Employee:
    manager = ensure_employee(session, manager_id)
    if manager.employee_type != "L":
        raise HTTPException(status_code=400, detail="Only leaders can be assigned as managers")
    if employee_id is not None and manager_id == employee_id:
        raise HTTPException(status_code=400, detail="Employee cannot manage themselves")
    if employee_id is not None and creates_manager_cycle(session, employee_id, manager_id):
        raise HTTPException(status_code=400, detail="Manager relationship creates a cycle")
    return manager


def creates_manager_cycle(session: Session, employee_id: int, manager_id: int) -> bool:
    seen: Set[int] = set()
    current_id: Optional[int] = manager_id
    while current_id is not None:
        if current_id == employee_id:
            return True
        if current_id in seen:
            return True
        seen.add(current_id)
        current = session.get(Employee, current_id)
        if not current:
            return False
        current_id = current.manager_id
    return False


def validate_demand_payload(session: Session, payload: dict[str, Any]) -> dict[str, Any]:
    project_id = payload.get("project_id")
    title = (payload.get("title") or "").strip()
    required_allocation = payload.get("required_allocation")
    start_date_value = payload.get("start_date")
    end_date_value = payload.get("end_date")
    organization_id = payload.get("organization_id")
    job_code_id = payload.get("job_code_id")
    if project_id is None:
        raise HTTPException(status_code=400, detail="Project is required")
    ensure_project(session, project_id)
    if not title:
        raise HTTPException(status_code=400, detail="Demand title is required")
    if required_allocation is None or required_allocation <= 0:
        raise HTTPException(status_code=400, detail="Required allocation must be greater than zero")
    if start_date_value is None or end_date_value is None or start_date_value > end_date_value:
        raise HTTPException(status_code=400, detail="Demand start date must be on or before end date")
    if organization_id is None:
        payload["organization_id"] = get_or_create_unassigned_organization(session).id
    else:
        ensure_organization(session, organization_id)
    if job_code_id is not None:
        ensure_job_code(session, job_code_id)
    payload["title"] = title
    payload["skill_notes"] = (payload.get("skill_notes") or "").strip() or None
    payload["notes"] = (payload.get("notes") or "").strip() or None
    return payload


def serialize_organization(session: Session, organization: Organization) -> OrganizationRead:
    parent_organization = session.get(Organization, organization.parent_organization_id) if organization.parent_organization_id is not None else None
    owner_employee = session.get(Employee, organization.owner_employee_id) if organization.owner_employee_id is not None else None
    child_organization_count = len(session.exec(select(Organization).where(Organization.parent_organization_id == organization.id)).all())
    return OrganizationRead(
        id=organization.id,
        name=organization.name,
        description=organization.description,
        parent_organization_id=organization.parent_organization_id,
        parent_organization_name=parent_organization.name if parent_organization else None,
        owner_employee_id=organization.owner_employee_id,
        owner_employee_name=owner_employee.name if owner_employee else None,
        child_organization_count=child_organization_count,
    )


def serialize_demand(session: Session, demand: Demand) -> DemandRead:
    project = session.get(Project, demand.project_id) if demand.project_id is not None else None
    organization = session.get(Organization, demand.organization_id) if demand.organization_id is not None else None
    job_code = session.get(JobCode, demand.job_code_id) if demand.job_code_id is not None else None
    assignments = session.exec(select(Assignment).where(Assignment.demand_id == demand.id)).all()
    fulfilled_allocation = round(sum(item.allocation for item in assignments), 2)
    remaining_allocation = round(max(demand.required_allocation - fulfilled_allocation, 0), 2)
    return DemandRead(
        id=demand.id,
        project_id=demand.project_id,
        project_name=project.name if project else None,
        title=demand.title,
        organization_id=demand.organization_id,
        organization_name=organization.name if organization else None,
        job_code_id=demand.job_code_id,
        job_code_name=job_code.name if job_code else None,
        skill_notes=demand.skill_notes,
        start_date=demand.start_date,
        end_date=demand.end_date,
        required_allocation=demand.required_allocation,
        fulfilled_allocation=fulfilled_allocation,
        remaining_allocation=remaining_allocation,
        notes=demand.notes,
    )


def serialize_employee(session: Session, employee: Employee) -> EmployeeRead:
    organization_name = None
    manager_name = None
    direct_report_count = 0
    job_code = session.get(JobCode, employee.job_code_id) if employee.job_code_id is not None else None
    if employee.organization_id is not None:
        organization = session.get(Organization, employee.organization_id)
        organization_name = organization.name if organization else None
    if employee.manager_id is not None:
        manager = session.get(Employee, employee.manager_id)
        manager_name = manager.name if manager else None
    direct_report_count = len(session.exec(select(Employee).where(Employee.manager_id == employee.id)).all())
    employee_type = "L" if job_code and job_code.is_leader else validate_employee_type(employee.employee_type or "IC")
    return EmployeeRead(
        id=employee.id,
        name=employee.name,
        job_code_id=employee.job_code_id,
        role=job_code.name if job_code else None,
        job_code_name=job_code.name if job_code else None,
        job_code_is_leader=bool(job_code and job_code.is_leader),
        employee_type=employee_type,
        location=employee.location,
        capacity=employee.capacity,
        organization_id=employee.organization_id,
        organization_name=organization_name,
        manager_id=employee.manager_id,
        manager_name=manager_name,
        direct_report_count=direct_report_count,
    )


def ensure_employee_and_project(session: Session, employee_id: int, project_id: int) -> None:
    ensure_employee(session, employee_id)
    ensure_project(session, project_id)


def serialize_assignment(session: Session, assignment: Assignment, current_username: Optional[str] = None) -> AssignmentRead:
    employee = session.get(Employee, assignment.employee_id)
    project = session.get(Project, assignment.project_id)
    organization = session.get(Organization, employee.organization_id) if employee and employee.organization_id is not None else None
    demand = session.get(Demand, assignment.demand_id) if assignment.demand_id is not None else None
    pending_approver_usernames = get_management_chain_usernames(assignment.employee_id) if assignment.status == "in_review" else []
    return AssignmentRead(
        id=assignment.id,
        employee_id=assignment.employee_id,
        project_id=assignment.project_id,
        demand_id=assignment.demand_id,
        start_date=assignment.start_date,
        end_date=assignment.end_date,
        allocation=assignment.allocation,
        notes=assignment.notes,
        employee_name=employee.name if employee else None,
        project_name=project.name if project else None,
        organization_id=employee.organization_id if employee else None,
        organization_name=organization.name if organization else None,
        demand_title=demand.title if demand else None,
        status=assignment.status,
        submitted_by_username=assignment.submitted_by_username,
        approved_by_username=assignment.approved_by_username,
        denied_by_username=assignment.denied_by_username,
        reviewed_at=assignment.reviewed_at,
        pending_approver_usernames=pending_approver_usernames,
        submitted_by_current_user=bool(current_username and assignment.submitted_by_username == current_username),
        requires_current_user_approval=bool(current_username and assignment.status == "in_review" and current_username in pending_approver_usernames),
    )


@app.get("/assignments", response_model=List[AssignmentRead])
def list_assignments(
    request: Request,
    employee_id: Optional[int] = None,
    project_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    current_username = get_request_username(request)
    statement = select(Assignment)
    if employee_id is not None:
        statement = statement.where(Assignment.employee_id == employee_id)
    if project_id is not None:
        statement = statement.where(Assignment.project_id == project_id)
    statement = statement.order_by(Assignment.start_date)
    assignments = session.exec(statement).all()
    return [serialize_assignment(session, a, current_username=current_username) for a in assignments]


@app.post("/assignments", response_model=AssignmentRead, status_code=201)
def create_assignment(assignment: AssignmentCreate, request: Request, session: Session = Depends(get_session)):
    submitter = get_request_username(request)
    ensure_employee_and_project(session, assignment.employee_id, assignment.project_id)
    if assignment.demand_id is not None:
        demand = ensure_demand(session, assignment.demand_id)
        if demand.project_id != assignment.project_id:
            raise HTTPException(status_code=400, detail="Demand must belong to the selected project")
    validate_dates(assignment.start_date, assignment.end_date)
    if not 0 < assignment.allocation <= 1:
        raise HTTPException(status_code=400, detail="Allocation must be between 0 and 1")
    approver_usernames = get_management_chain_usernames(assignment.employee_id)
    if not approver_usernames and not is_admin_username(submitter):
        raise HTTPException(status_code=400, detail="No linked manager-chain user accounts are available to review this assignment")
    db_assignment = Assignment.from_orm(assignment)
    db_assignment.status = "in_review"
    db_assignment.submitted_by_username = submitter
    session.add(db_assignment)
    session.commit()
    session.refresh(db_assignment)
    assignment_read = serialize_assignment(session, db_assignment)
    ensure_assignment_review_notifications(db_assignment)
    record_audit_entry(
        session,
        actor_username=submitter,
        entity_type="assignment",
        action="submit_for_review",
        entity_id=db_assignment.id,
        entity_label=f"{assignment_read.employee_name or db_assignment.employee_id} → {assignment_read.project_name or db_assignment.project_id}",
        after=audit_snapshot_from_model(assignment_read),
    )
    return assignment_read


@app.put("/assignments/{assignment_id}", response_model=AssignmentRead)
def update_assignment(
    assignment_id: int,
    update: AssignmentUpdate,
    request: Request,
    session: Session = Depends(get_session),
):
    assignment = session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    before = audit_snapshot_from_model(serialize_assignment(session, assignment))
    if update.start_date or update.end_date:
        validate_dates(update.start_date or assignment.start_date, update.end_date or assignment.end_date)
    if update.allocation is not None and not 0 < update.allocation <= 1:
        raise HTTPException(status_code=400, detail="Allocation must be between 0 and 1")
    if update.demand_id is not None:
        demand = ensure_demand(session, update.demand_id)
        if demand.project_id != assignment.project_id:
            raise HTTPException(status_code=400, detail="Demand must belong to the selected project")
    data = update.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(assignment, key, value)
    session.add(assignment)
    session.commit()
    session.refresh(assignment)
    assignment_read = serialize_assignment(session, assignment)
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="assignment",
        action="update",
        entity_id=assignment.id,
        entity_label=f"{assignment_read.employee_name or assignment.employee_id} → {assignment_read.project_name or assignment.project_id}",
        before=before,
        after=audit_snapshot_from_model(assignment_read),
    )
    return assignment_read


@app.post("/assignments/{assignment_id}/approve", response_model=AssignmentRead)
def approve_assignment(assignment_id: int, request: Request, session: Session = Depends(get_session)):
    username = get_request_username(request)
    assignment = session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.status != "in_review":
        raise HTTPException(status_code=400, detail="Assignment is no longer awaiting review")
    if not can_review_assignment(username, assignment):
        raise HTTPException(status_code=403, detail="You are not allowed to review this assignment")
    before = audit_snapshot_from_model(serialize_assignment(session, assignment, current_username=username))
    assignment.status = "approved"
    assignment.approved_by_username = username
    assignment.denied_by_username = None
    assignment.reviewed_at = datetime.now(timezone.utc)
    session.add(assignment)
    session.commit()
    session.refresh(assignment)
    assignment_read = serialize_assignment(session, assignment, current_username=username)
    with Session(control_engine) as control_session:
        if assignment.submitted_by_username:
            add_inbox_notification(
                control_session,
                username=assignment.submitted_by_username,
                title="Assignment request approved",
                message=f"{username} approved your assignment request for {assignment_read.employee_name or 'employee'} → {assignment_read.project_name or 'project'}.",
                metadata={"kind": "assignment_review_result", "assignment_id": assignment.id, "result": "approved"},
            )
    record_audit_entry(
        session,
        actor_username=username,
        entity_type="assignment",
        action="approve",
        entity_id=assignment.id,
        entity_label=f"{assignment_read.employee_name or assignment.employee_id} → {assignment_read.project_name or assignment.project_id}",
        before=before,
        after=audit_snapshot_from_model(assignment_read),
    )
    return assignment_read


@app.post("/assignments/{assignment_id}/deny", response_model=AssignmentRead)
def deny_assignment(assignment_id: int, request: Request, session: Session = Depends(get_session)):
    username = get_request_username(request)
    assignment = session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.status != "in_review":
        raise HTTPException(status_code=400, detail="Assignment is no longer awaiting review")
    if not can_review_assignment(username, assignment):
        raise HTTPException(status_code=403, detail="You are not allowed to review this assignment")
    before = audit_snapshot_from_model(serialize_assignment(session, assignment, current_username=username))
    assignment.status = "denied"
    assignment.denied_by_username = username
    assignment.approved_by_username = None
    assignment.reviewed_at = datetime.now(timezone.utc)
    session.add(assignment)
    session.commit()
    session.refresh(assignment)
    assignment_read = serialize_assignment(session, assignment, current_username=username)
    with Session(control_engine) as control_session:
        if assignment.submitted_by_username:
            add_inbox_notification(
                control_session,
                username=assignment.submitted_by_username,
                title="Assignment request denied",
                message=f"{username} denied your assignment request for {assignment_read.employee_name or 'employee'} → {assignment_read.project_name or 'project'}.",
                metadata={"kind": "assignment_review_result", "assignment_id": assignment.id, "result": "denied"},
            )
    record_audit_entry(
        session,
        actor_username=username,
        entity_type="assignment",
        action="deny",
        entity_id=assignment.id,
        entity_label=f"{assignment_read.employee_name or assignment.employee_id} → {assignment_read.project_name or assignment.project_id}",
        before=before,
        after=audit_snapshot_from_model(assignment_read),
    )
    return assignment_read


@app.post("/assignments/{assignment_id}/refresh-approvers", response_model=AssignmentRead)
def refresh_assignment_approvers(assignment_id: int, request: Request, session: Session = Depends(get_session)):
    username = get_request_username(request)
    assignment = session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.status != "in_review":
        raise HTTPException(status_code=400, detail="Only in-review assignments can refresh approvers")
    if not (is_admin_username(username) or assignment.submitted_by_username == username or can_review_assignment(username, assignment)):
        raise HTTPException(status_code=403, detail="You are not allowed to refresh approvers for this assignment")
    created_for = ensure_assignment_review_notifications(assignment)
    assignment_read = serialize_assignment(session, assignment, current_username=username)
    record_audit_entry(
        session,
        actor_username=username,
        entity_type="assignment",
        action="refresh_approvers",
        entity_id=assignment.id,
        entity_label=f"{assignment_read.employee_name or assignment.employee_id} → {assignment_read.project_name or assignment.project_id}",
        after={"created_review_notifications_for": created_for},
    )
    return assignment_read


@app.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int, request: Request, session: Session = Depends(get_session)):
    assignment = session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    before_assignment = serialize_assignment(session, assignment)
    label = f"{before_assignment.employee_name or assignment.employee_id} → {before_assignment.project_name or assignment.project_id}"
    before = audit_snapshot_from_model(before_assignment)
    session.delete(assignment)
    session.commit()
    record_audit_entry(
        session,
        actor_username=get_request_username(request),
        entity_type="assignment",
        action="delete",
        entity_id=assignment_id,
        entity_label=label,
        before=before,
    )


@app.get("/schedule/employee/{employee_id}", response_model=List[AssignmentRead])
def get_employee_schedule(employee_id: int, session: Session = Depends(get_session)):
    ensure_employee(session, employee_id)
    assignments = session.exec(
        select(Assignment).where(Assignment.employee_id == employee_id).order_by(Assignment.start_date)
    ).all()
    return [serialize_assignment(session, a) for a in assignments]


@app.get("/schedule/project/{project_id}", response_model=List[AssignmentRead])
def get_project_schedule(project_id: int, session: Session = Depends(get_session)):
    ensure_project(session, project_id)
    assignments = session.exec(
        select(Assignment).where(Assignment.project_id == project_id).order_by(Assignment.start_date)
    ).all()
    return [serialize_assignment(session, a) for a in assignments]


@app.get("/runtime-overview", response_model=RuntimeOverviewRead)
def runtime_overview(request: Request):
    require_admin_user(request)
    return get_runtime_overview()


@app.get("/runtime-errors", response_model=List[RuntimeErrorLogRead])
def list_runtime_errors(request: Request, limit: int = 100, session: Session = Depends(get_control_session)):
    require_admin_user(request)
    safe_limit = max(1, min(limit, 500))
    items = session.exec(select(RuntimeErrorLog).order_by(RuntimeErrorLog.occurred_at.desc(), RuntimeErrorLog.id.desc())).all()
    return [serialize_runtime_error(item) for item in items[:safe_limit]]


@app.get("/runtime-error-groups", response_model=List[RuntimeErrorGroupRead])
def list_runtime_error_groups(request: Request, limit: int = 20, session: Session = Depends(get_control_session)):
    require_admin_user(request)
    safe_limit = max(1, min(limit, 100))
    items = session.exec(select(RuntimeErrorLog).order_by(RuntimeErrorLog.occurred_at.desc(), RuntimeErrorLog.id.desc())).all()
    grouped: dict[tuple[str, str], RuntimeErrorGroupRead] = {}
    for item in items:
        key = (item.error_type, item.message)
        existing = grouped.get(key)
        if existing:
            existing.count += 1
            if item.occurred_at > existing.last_seen_at:
                existing.last_seen_at = item.occurred_at
                existing.sample_path = item.path
                existing.sample_username = item.username
            continue
        grouped[key] = RuntimeErrorGroupRead(
            error_type=item.error_type,
            message=item.message,
            count=1,
            last_seen_at=item.occurred_at,
            sample_path=item.path,
            sample_username=item.username,
        )
    results = sorted(grouped.values(), key=lambda entry: (entry.count, entry.last_seen_at), reverse=True)
    return results[:safe_limit]


@app.get("/runtime-health-snapshots", response_model=List[RuntimeHealthSnapshotRead])
def list_runtime_health_snapshots(request: Request, limit: int = 30, session: Session = Depends(get_control_session)):
    require_admin_user(request)
    safe_limit = max(1, min(limit, 240))
    items = session.exec(select(RuntimeHealthSnapshot).order_by(RuntimeHealthSnapshot.occurred_at.desc(), RuntimeHealthSnapshot.id.desc())).all()
    return [serialize_runtime_snapshot(item) for item in items[:safe_limit]]


@app.get("/audit-log", response_model=List[AuditEntryRead])
def list_audit_log(
    entity_type: str = "",
    action: str = "",
    actor: str = "",
    query: str = "",
    session: Session = Depends(get_session),
):
    statement = select(AuditEntry).order_by(AuditEntry.occurred_at.desc(), AuditEntry.id.desc())
    entries = session.exec(statement).all()
    query_text = query.strip().lower()
    if entity_type:
        entries = [entry for entry in entries if entry.entity_type == entity_type]
    if action:
        entries = [entry for entry in entries if entry.action == action]
    if actor:
        entries = [entry for entry in entries if entry.actor_username == actor]
    if query_text:
        entries = [
            entry for entry in entries
            if query_text in (entry.entity_label or "").lower()
            or query_text in (entry.before_json or "").lower()
            or query_text in (entry.after_json or "").lower()
            or query_text in entry.entity_type.lower()
        ]
    return [serialize_audit_entry(entry) for entry in entries]


@app.get("/audit-log/export")
def export_audit_log_csv(
    entity_type: str = "",
    action: str = "",
    actor: str = "",
    query: str = "",
    session: Session = Depends(get_session),
):
    entries = list_audit_log(entity_type=entity_type, action=action, actor=actor, query=query, session=session)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "occurred_at", "actor_username", "entity_type", "entity_id", "entity_label", "action", "before_json", "after_json"])
    for entry in entries:
        writer.writerow([
            entry.id,
            entry.occurred_at.isoformat(),
            entry.actor_username,
            entry.entity_type,
            entry.entity_id or "",
            entry.entity_label or "",
            entry.action,
            entry.before_json or "",
            entry.after_json or "",
        ])
    return PlainTextResponse(
        output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="audit_log_{date.today().isoformat()}.csv"'},
    )


@app.delete("/audit-log", status_code=204)
def clear_audit_log(request: Request, session: Session = Depends(get_session)):
    actor_username = require_admin_user(request)
    existing_entries = session.exec(select(AuditEntry)).all()
    removed_count = len(existing_entries)
    for entry in existing_entries:
        session.delete(entry)
    session.commit()
    record_audit_entry(
        session,
        actor_username=actor_username,
        entity_type="audit",
        action="clear",
        entity_label="Audit history",
        after={"removed_entries": removed_count},
    )


@app.get("/inbox-api", response_model=List[InboxNotificationRead])
def list_inbox_notifications(request: Request, session: Session = Depends(get_control_session)):
    username = get_request_username(request)
    items = session.exec(
        select(InboxNotification)
        .where(InboxNotification.username == username)
        .order_by(InboxNotification.is_read.asc(), InboxNotification.created_at.desc())
    ).all()
    return [serialize_inbox_notification(item) for item in items]


@app.post("/inbox-api/{notification_id}/read", response_model=InboxNotificationRead)
def mark_inbox_notification_read(notification_id: int, request: Request, session: Session = Depends(get_control_session)):
    username = get_request_username(request)
    notification = session.get(InboxNotification, notification_id)
    if not notification or notification.username != username:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return serialize_inbox_notification(notification)


@app.post("/inbox-api/{notification_id}/approve", response_model=InboxNotificationRead)
def approve_inbox_notification(notification_id: int, request: Request, session: Session = Depends(get_control_session)):
    username = get_request_username(request)
    notification = session.get(InboxNotification, notification_id)
    if not notification or notification.username != username:
        raise HTTPException(status_code=404, detail="Notification not found")
    metadata = json.loads(notification.metadata_json) if notification.metadata_json else {}
    if metadata.get("kind") != "assignment_review":
        raise HTTPException(status_code=400, detail="Notification is not actionable")
    assignment_id = metadata.get("assignment_id")
    active_connection = get_active_db_connection_config()
    data_engine = get_or_create_data_engine(active_connection)
    with Session(data_engine) as data_session:
        assignment = data_session.get(Assignment, assignment_id)
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        if assignment.status != "in_review":
            raise HTTPException(status_code=400, detail="Assignment is no longer awaiting review")
        if not can_review_assignment(username, assignment):
            raise HTTPException(status_code=403, detail="You are not allowed to review this assignment")
        assignment.status = "approved"
        assignment.approved_by_username = username
        assignment.reviewed_at = datetime.now(timezone.utc)
        data_session.add(assignment)
        data_session.commit()
    notification.is_read = True
    session.add(notification)
    session.commit()
    retire_assignment_review_notifications(session, assignment_id)
    session.refresh(notification)
    submitter_username = metadata.get("submitter_username")
    if submitter_username:
        add_inbox_notification(
            session,
            username=submitter_username,
            title="Assignment request approved",
            message=f"{username} approved your assignment request for {metadata.get('employee_name') or 'employee'} → {metadata.get('project_name') or 'project'}.",
            metadata={"kind": "assignment_review_result", "assignment_id": assignment_id, "result": "approved"},
        )
    return serialize_inbox_notification(notification)


@app.post("/inbox-api/{notification_id}/deny", response_model=InboxNotificationRead)
def deny_inbox_notification(notification_id: int, request: Request, session: Session = Depends(get_control_session)):
    username = get_request_username(request)
    notification = session.get(InboxNotification, notification_id)
    if not notification or notification.username != username:
        raise HTTPException(status_code=404, detail="Notification not found")
    metadata = json.loads(notification.metadata_json) if notification.metadata_json else {}
    if metadata.get("kind") != "assignment_review":
        raise HTTPException(status_code=400, detail="Notification is not actionable")
    assignment_id = metadata.get("assignment_id")
    active_connection = get_active_db_connection_config()
    data_engine = get_or_create_data_engine(active_connection)
    with Session(data_engine) as data_session:
        assignment = data_session.get(Assignment, assignment_id)
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        if assignment.status != "in_review":
            raise HTTPException(status_code=400, detail="Assignment is no longer awaiting review")
        if not can_review_assignment(username, assignment):
            raise HTTPException(status_code=403, detail="You are not allowed to review this assignment")
        assignment.status = "denied"
        assignment.denied_by_username = username
        assignment.reviewed_at = datetime.now(timezone.utc)
        data_session.add(assignment)
        data_session.commit()
    notification.is_read = True
    session.add(notification)
    session.commit()
    retire_assignment_review_notifications(session, assignment_id)
    session.refresh(notification)
    submitter_username = metadata.get("submitter_username")
    if submitter_username:
        add_inbox_notification(
            session,
            username=submitter_username,
            title="Assignment request denied",
            message=f"{username} denied your assignment request for {metadata.get('employee_name') or 'employee'} → {metadata.get('project_name') or 'project'}.",
            metadata={"kind": "assignment_review_result", "assignment_id": assignment_id, "result": "denied"},
        )
    return serialize_inbox_notification(notification)


@app.delete("/inbox-api/{notification_id}", status_code=204)
def delete_inbox_notification(notification_id: int, request: Request, session: Session = Depends(get_control_session)):
    username = get_request_username(request)
    notification = session.get(InboxNotification, notification_id)
    if not notification or notification.username != username:
        raise HTTPException(status_code=404, detail="Notification not found")
    session.delete(notification)
    session.commit()


@app.get("/users-api", response_model=List[UserAccountRead])
def list_users(request: Request, session: Session = Depends(get_control_session)):
    require_admin_user(request)
    items = session.exec(select(UserAccount).order_by(UserAccount.username)).all()
    return [serialize_user_account(item) for item in items]


@app.post("/users-api", response_model=UserAccountRead, status_code=201)
def create_user(user: UserAccountCreate, request: Request, session: Session = Depends(get_control_session)):
    require_admin_user(request)
    username = user.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if session.exec(select(UserAccount).where(UserAccount.username == username)).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if len(user.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if user.employee_id is not None:
        active_connection = get_active_db_connection_config()
        data_engine = get_or_create_data_engine(active_connection)
        with Session(data_engine) as data_session:
            if not data_session.get(Employee, user.employee_id):
                raise HTTPException(status_code=400, detail="Linked employee not found")
    db_user = UserAccount(
        username=username,
        password_hash=hash_password(user.password),
        employee_id=user.employee_id,
        first_name=(user.first_name or "").strip() or None,
        last_name=(user.last_name or "").strip() or None,
        email=(user.email or "").strip() or None,
        profile_picture_url=(user.profile_picture_url or "").strip() or None,
        is_admin=user.is_admin,
        is_active=True,
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    ensure_inbox_welcome_notification(db_user.username)
    if db_user.employee_id is not None:
        refresh_assignment_reviews_for_employee_link(db_user.employee_id, control_session=session)
    return serialize_user_account(db_user)


@app.put("/users-api/{user_id}", response_model=UserAccountRead)
def update_user(user_id: int, update: UserAccountUpdate, request: Request, session: Session = Depends(get_control_session)):
    require_admin_user(request)
    user = session.get(UserAccount, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    previous_employee_id = user.employee_id
    data = update.model_dump(exclude_unset=True)
    if "password" in data and data["password"] is not None:
        if len(data["password"]) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        user.password_hash = hash_password(data.pop("password"))
    if "employee_id" in data and data["employee_id"] is not None:
        active_connection = get_active_db_connection_config()
        data_engine = get_or_create_data_engine(active_connection)
        with Session(data_engine) as data_session:
            if not data_session.get(Employee, data["employee_id"]):
                raise HTTPException(status_code=400, detail="Linked employee not found")
    for text_field in ("first_name", "last_name", "email", "profile_picture_url"):
        if text_field in data:
            data[text_field] = (data[text_field] or "").strip() or None
    for key, value in data.items():
        setattr(user, key, value)
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)
    if user.employee_id is not None and user.employee_id != previous_employee_id:
        refresh_assignment_reviews_for_employee_link(user.employee_id, control_session=session)
    return serialize_user_account(user)


@app.delete("/users-api/{user_id}", status_code=204)
def delete_user(user_id: int, request: Request, session: Session = Depends(get_control_session)):
    current_username = require_admin_user(request)
    user = session.get(UserAccount, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == current_username:
        raise HTTPException(status_code=400, detail="You cannot delete your current user")
    session.delete(user)
    session.commit()


@app.get("/account-settings-api", response_model=AccountSettingsRead)
def read_account_settings(request: Request, session: Session = Depends(get_control_session)):
    username = get_request_username(request)
    return get_account_settings(username, session)


@app.put("/account-settings-api", response_model=AccountSettingsRead)
def update_account_settings(update: AccountSettingsUpdate, request: Request, session: Session = Depends(get_control_session)):
    username = get_request_username(request)
    user = session.exec(select(UserAccount).where(UserAccount.username == username)).first()
    if not user:
        raise HTTPException(status_code=400, detail="This account is not backed by a Matrix Manager user record")
    data = update.model_dump(exclude_unset=True)
    for field_name in ("first_name", "last_name", "email", "profile_picture_url"):
        if field_name in data:
            setattr(user, field_name, (data[field_name] or "").strip() or None)
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)
    return get_account_settings(username, session)


@app.get("/db-connections", response_model=List[DBConnectionRead])
def list_db_connections(request: Request, session: Session = Depends(get_control_session)):
    require_admin_user(request)
    items = session.exec(select(DBConnectionConfig).order_by(DBConnectionConfig.name)).all()
    return [serialize_db_connection(item) for item in items]


@app.post("/db-connections", response_model=DBConnectionRead, status_code=201)
def create_db_connection(connection: DBConnectionCreate, request: Request, session: Session = Depends(get_control_session)):
    require_admin_user(request)
    payload = normalize_db_connection_payload(connection.model_dump())
    db_connection = DBConnectionConfig(**payload)
    if not session.exec(select(DBConnectionConfig)).first():
        db_connection.is_active = True
    session.add(db_connection)
    session.commit()
    session.refresh(db_connection)
    if db_connection.is_active:
        get_or_create_data_engine(db_connection)
    return serialize_db_connection(db_connection)


@app.put("/db-connections/{connection_id}", response_model=DBConnectionRead)
def update_db_connection(connection_id: int, update: DBConnectionUpdate, request: Request, session: Session = Depends(get_control_session)):
    require_admin_user(request)
    db_connection = session.get(DBConnectionConfig, connection_id)
    if not db_connection:
        raise HTTPException(status_code=404, detail="Database connection not found")
    current = db_connection.model_dump()
    for key, value in update.model_dump(exclude_unset=True).items():
        current[key] = value
    payload = normalize_db_connection_payload(current)
    for key, value in payload.items():
        setattr(db_connection, key, value)
    db_connection.updated_at = datetime.now(timezone.utc)
    session.add(db_connection)
    session.commit()
    session.refresh(db_connection)
    if db_connection.is_active:
        get_or_create_data_engine(db_connection)
    return serialize_db_connection(db_connection)


@app.post("/db-connections/{connection_id}/activate", response_model=DBConnectionRead)
def activate_db_connection(connection_id: int, request: Request, session: Session = Depends(get_control_session)):
    require_admin_user(request)
    db_connection = session.get(DBConnectionConfig, connection_id)
    if not db_connection:
        raise HTTPException(status_code=404, detail="Database connection not found")
    all_connections = session.exec(select(DBConnectionConfig)).all()
    for item in all_connections:
        item.is_active = item.id == connection_id
        item.updated_at = datetime.now(timezone.utc)
        session.add(item)
    session.commit()
    session.refresh(db_connection)
    get_or_create_data_engine(db_connection)
    return serialize_db_connection(db_connection)


@app.delete("/db-connections/{connection_id}", status_code=204)
def delete_db_connection(connection_id: int, request: Request, session: Session = Depends(get_control_session)):
    require_admin_user(request)
    db_connection = session.get(DBConnectionConfig, connection_id)
    if not db_connection:
        raise HTTPException(status_code=404, detail="Database connection not found")
    if db_connection.is_active:
        raise HTTPException(status_code=400, detail="Cannot delete the active database connection")
    session.delete(db_connection)
    session.commit()


@app.post("/db-management/wipe-data-db", status_code=204)
def wipe_data_db(payload: WipeDataDbRequest, request: Request, session: Session = Depends(get_control_session)):
    actor_username = require_admin_user(request)
    if payload.confirmation_text.strip() != "WIPE DATA DB":
        raise HTTPException(status_code=400, detail='Type "WIPE DATA DB" to confirm')
    active_connection = get_active_db_connection_config()
    wipe_primary_data_db()
    record_audit_entry(
        session,
        actor_username=actor_username,
        entity_type="data_db",
        action="wipe",
        entity_label=build_connection_summary(active_connection),
        after={"db_type": active_connection.db_type, "connection_summary": build_connection_summary(active_connection)},
    )

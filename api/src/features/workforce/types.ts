export interface OrganizationRecord {
  id: number;
  name: string;
  description: string | null;
  parent_organization_id: number | null;
  owner_employee_id: number | null;
}

export interface JobCodeRecord {
  id: number;
  name: string;
  is_leader: boolean;
}

export interface EmployeeRecord {
  id: number;
  name: string;
  job_code_id: number | null;
  employee_type: string;
  role: string | null;
  location: string | null;
  capacity: number;
  manager_id: number | null;
  organization_id: number;
}

export interface ProjectRecord {
  id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface DemandRecord {
  id: number;
  project_id: number;
  title: string;
  organization_id: number | null;
  job_code_id: number | null;
  skill_notes: string | null;
  start_date: string;
  end_date: string;
  required_allocation: number;
  notes: string | null;
}

export interface AssignmentRecord {
  id: number;
  employee_id: number;
  project_id: number;
  demand_id: number | null;
  start_date: string;
  end_date: string;
  allocation: number;
  notes: string | null;
  status: 'approved';
}

export interface DashboardPreferencesRecord {
  tracked_employee_ids: number[];
}

export interface WorkforceState {
  organizations: OrganizationRecord[];
  jobCodes: JobCodeRecord[];
  employees: EmployeeRecord[];
  projects: ProjectRecord[];
  demands: DemandRecord[];
  assignments: AssignmentRecord[];
  dashboard: Record<string, DashboardPreferencesRecord>;
}

export interface OrganizationRecord {
  id: number;
  name: string;
  description: string | null;
  parent_organization_id: number | null;
  owner_employee_id: number | null;
}

export interface EmployeeRecord {
  id: number;
  name: string;
  job_code_id: number | null;
  employee_type: string;
  location: string | null;
  capacity: number;
  manager_id: number | null;
  organization_id: number;
}

export interface WorkforceState {
  organizations: OrganizationRecord[];
  employees: EmployeeRecord[];
}

import { z } from 'zod';

const optionalDate = z.string().trim().nullable().optional().default(null);
const requiredDate = z.string().trim().min(1);

export const organizationCreateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional().default(null),
  parent_organization_id: z.number().int().nullable().optional().default(null),
  owner_employee_id: z.number().int().nullable().optional().default(null)
});

export const organizationUpdateSchema = organizationCreateSchema.partial();

export const jobCodeCreateSchema = z.object({
  name: z.string().trim().min(1),
  is_leader: z.boolean().default(false)
});

export const jobCodeUpdateSchema = jobCodeCreateSchema.partial();

export const employeeCreateSchema = z.object({
  name: z.string().trim().min(1),
  job_code_id: z.number().int().nullable().optional().default(null),
  employee_type: z.string().trim().min(1).optional(),
  role: z.string().trim().nullable().optional().default(null),
  location: z.string().trim().nullable().optional().default(null),
  capacity: z.number().positive().default(1),
  manager_id: z.number().int().nullable().optional().default(null),
  organization_id: z.number().int()
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional().default(null),
  start_date: optionalDate,
  end_date: optionalDate
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const demandCreateSchema = z.object({
  project_id: z.number().int(),
  title: z.string().trim().min(1),
  organization_id: z.number().int().nullable().optional().default(null),
  job_code_id: z.number().int().nullable().optional().default(null),
  skill_notes: z.string().trim().nullable().optional().default(null),
  start_date: requiredDate,
  end_date: requiredDate,
  required_allocation: z.number().positive(),
  notes: z.string().trim().nullable().optional().default(null)
});

export const demandUpdateSchema = demandCreateSchema.partial();

export const assignmentCreateSchema = z.object({
  employee_id: z.number().int(),
  project_id: z.number().int(),
  demand_id: z.number().int().nullable().optional().default(null),
  start_date: requiredDate,
  end_date: requiredDate,
  allocation: z.number().positive(),
  notes: z.string().trim().nullable().optional().default(null)
});

export const assignmentUpdateSchema = assignmentCreateSchema.partial();

export const dashboardTrackedEmployeesSchema = z.object({
  employee_ids: z.array(z.number().int()).default([])
});

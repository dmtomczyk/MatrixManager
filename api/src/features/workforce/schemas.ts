import { z } from 'zod';

export const organizationCreateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional().default(null),
  parent_organization_id: z.number().int().nullable().optional().default(null),
  owner_employee_id: z.number().int().nullable().optional().default(null)
});

export const organizationUpdateSchema = organizationCreateSchema.partial();

export const employeeCreateSchema = z.object({
  name: z.string().trim().min(1),
  job_code_id: z.number().int().nullable().optional().default(null),
  employee_type: z.string().trim().min(1).default('IC'),
  location: z.string().trim().nullable().optional().default(null),
  capacity: z.number().positive().default(1),
  manager_id: z.number().int().nullable().optional().default(null),
  organization_id: z.number().int()
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

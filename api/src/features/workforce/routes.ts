import type { FastifyPluginAsync } from 'fastify';
import {
  createEmployee,
  createJobCode,
  createOrganization,
  deleteEmployee,
  deleteJobCode,
  deleteOrganization,
  formatWorkforceError,
  getEmployee,
  listEmployees,
  listJobCodes,
  listOrganizations,
  updateEmployee,
  updateJobCode,
  updateOrganization
} from './service.js';

export const workforceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/organizations', async () => listOrganizations());

  app.post('/organizations', async (request, reply) => {
    try {
      const organization = createOrganization(request.body);
      reply.code(201);
      return organization;
    } catch (error) {
      const formatted = formatWorkforceError(error);
      reply.code(formatted.statusCode);
      return { detail: formatted.detail };
    }
  });

  app.put('/organizations/:organizationId', async (request, reply) => {
    try {
      const organizationId = Number((request.params as { organizationId: string }).organizationId);
      const organization = updateOrganization(organizationId, request.body);
      if (!organization) {
        reply.code(404);
        return { detail: 'Organization not found' };
      }
      return organization;
    } catch (error) {
      const formatted = formatWorkforceError(error);
      reply.code(formatted.statusCode);
      return { detail: formatted.detail };
    }
  });

  app.delete('/organizations/:organizationId', async (request, reply) => {
    const organizationId = Number((request.params as { organizationId: string }).organizationId);
    const result = deleteOrganization(organizationId);
    if (!result.ok) {
      reply.code(result.status);
      return { detail: result.detail };
    }
    reply.code(204);
    return null;
  });

  app.get('/job-codes-api', async () => listJobCodes());

  app.post('/job-codes-api', async (request, reply) => {
    try {
      const jobCode = createJobCode(request.body);
      reply.code(201);
      return jobCode;
    } catch (error) {
      const formatted = formatWorkforceError(error);
      reply.code(formatted.statusCode);
      return { detail: formatted.detail };
    }
  });

  app.put('/job-codes-api/:jobCodeId', async (request, reply) => {
    try {
      const jobCodeId = Number((request.params as { jobCodeId: string }).jobCodeId);
      const jobCode = updateJobCode(jobCodeId, request.body);
      if (!jobCode) {
        reply.code(404);
        return { detail: 'Job code not found' };
      }
      return jobCode;
    } catch (error) {
      const formatted = formatWorkforceError(error);
      reply.code(formatted.statusCode);
      return { detail: formatted.detail };
    }
  });

  app.delete('/job-codes-api/:jobCodeId', async (request, reply) => {
    const jobCodeId = Number((request.params as { jobCodeId: string }).jobCodeId);
    const result = deleteJobCode(jobCodeId);
    if (!result.ok) {
      reply.code(result.status);
      return { detail: result.detail };
    }
    reply.code(204);
    return null;
  });

  app.get('/employees', async () => listEmployees());

  app.post('/employees', async (request, reply) => {
    try {
      const employee = createEmployee(request.body);
      reply.code(201);
      return employee;
    } catch (error) {
      const formatted = formatWorkforceError(error);
      reply.code(formatted.statusCode);
      return { detail: formatted.detail };
    }
  });

  app.get('/employees/:employeeId', async (request, reply) => {
    const employeeId = Number((request.params as { employeeId: string }).employeeId);
    const employee = getEmployee(employeeId);
    if (!employee) {
      reply.code(404);
      return { detail: 'Employee not found' };
    }
    return employee;
  });

  app.put('/employees/:employeeId', async (request, reply) => {
    try {
      const employeeId = Number((request.params as { employeeId: string }).employeeId);
      const employee = updateEmployee(employeeId, request.body);
      if (!employee) {
        reply.code(404);
        return { detail: 'Employee not found' };
      }
      return employee;
    } catch (error) {
      const formatted = formatWorkforceError(error);
      reply.code(formatted.statusCode);
      return { detail: formatted.detail };
    }
  });

  app.delete('/employees/:employeeId', async (request, reply) => {
    const employeeId = Number((request.params as { employeeId: string }).employeeId);
    const result = deleteEmployee(employeeId);
    if (!result.ok) {
      reply.code(result.status);
      return { detail: result.detail };
    }
    reply.code(204);
    return null;
  });
};

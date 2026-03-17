import type { FastifyPluginAsync } from 'fastify';
import {
  createEmployee,
  createOrganization,
  deleteEmployee,
  deleteOrganization,
  getEmployee,
  listEmployees,
  listOrganizations,
  updateEmployee,
  updateOrganization
} from './service.js';

export const workforceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/organizations', async () => listOrganizations());

  app.post('/organizations', async (request, reply) => {
    const organization = createOrganization(request.body);
    reply.code(201);
    return organization;
  });

  app.put('/organizations/:organizationId', async (request, reply) => {
    const organizationId = Number((request.params as { organizationId: string }).organizationId);
    const organization = updateOrganization(organizationId, request.body);
    if (!organization) {
      reply.code(404);
      return { detail: 'Organization not found' };
    }
    return organization;
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

  app.get('/employees', async () => listEmployees());

  app.post('/employees', async (request, reply) => {
    const employee = createEmployee(request.body);
    reply.code(201);
    return employee;
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
    const employeeId = Number((request.params as { employeeId: string }).employeeId);
    const employee = updateEmployee(employeeId, request.body);
    if (!employee) {
      reply.code(404);
      return { detail: 'Employee not found' };
    }
    return employee;
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

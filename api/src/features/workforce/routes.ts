import type { FastifyPluginAsync } from 'fastify';
import {
  createAssignment,
  createDemand,
  createEmployee,
  createJobCode,
  createOrganization,
  createProject,
  deleteAssignment,
  deleteDemand,
  deleteEmployee,
  deleteJobCode,
  deleteOrganization,
  deleteProject,
  formatWorkforceError,
  getDashboardData,
  getEmployee,
  getForecastData,
  listAssignments,
  listDemands,
  listEmployees,
  listEmployeeSchedule,
  listJobCodes,
  listOrganizations,
  listProjectSchedule,
  listProjects,
  updateAssignment,
  updateDashboardTrackedEmployees,
  updateDemand,
  updateEmployee,
  updateJobCode,
  updateOrganization,
  updateProject
} from './service.js';

export const workforceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/organizations', async () => listOrganizations());
  app.post('/organizations', async (request, reply) => { try { const organization = createOrganization(request.body); reply.code(201); return organization; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.put('/organizations/:organizationId', async (request, reply) => { try { const organizationId = Number((request.params as { organizationId: string }).organizationId); const organization = updateOrganization(organizationId, request.body); if (!organization) { reply.code(404); return { detail: 'Organization not found' }; } return organization; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.delete('/organizations/:organizationId', async (request, reply) => { const organizationId = Number((request.params as { organizationId: string }).organizationId); const result = deleteOrganization(organizationId); if (!result.ok) { reply.code(result.status); return { detail: result.detail }; } reply.code(204); return null; });

  app.get('/job-codes-api', async () => listJobCodes());
  app.post('/job-codes-api', async (request, reply) => { try { const jobCode = createJobCode(request.body); reply.code(201); return jobCode; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.put('/job-codes-api/:jobCodeId', async (request, reply) => { try { const jobCodeId = Number((request.params as { jobCodeId: string }).jobCodeId); const jobCode = updateJobCode(jobCodeId, request.body); if (!jobCode) { reply.code(404); return { detail: 'Job code not found' }; } return jobCode; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.delete('/job-codes-api/:jobCodeId', async (request, reply) => { const jobCodeId = Number((request.params as { jobCodeId: string }).jobCodeId); const result = deleteJobCode(jobCodeId); if (!result.ok) { reply.code(result.status); return { detail: result.detail }; } reply.code(204); return null; });

  app.get('/employees', async () => listEmployees());
  app.post('/employees', async (request, reply) => { try { const employee = createEmployee(request.body); reply.code(201); return employee; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.get('/employees/:employeeId', async (request, reply) => { const employeeId = Number((request.params as { employeeId: string }).employeeId); const employee = getEmployee(employeeId); if (!employee) { reply.code(404); return { detail: 'Employee not found' }; } return employee; });
  app.put('/employees/:employeeId', async (request, reply) => { try { const employeeId = Number((request.params as { employeeId: string }).employeeId); const employee = updateEmployee(employeeId, request.body); if (!employee) { reply.code(404); return { detail: 'Employee not found' }; } return employee; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.delete('/employees/:employeeId', async (request, reply) => { const employeeId = Number((request.params as { employeeId: string }).employeeId); const result = deleteEmployee(employeeId); if (!result.ok) { reply.code(result.status); return { detail: result.detail }; } reply.code(204); return null; });

  app.get('/projects', async () => listProjects());
  app.post('/projects', async (request, reply) => { try { const project = createProject(request.body); reply.code(201); return project; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.put('/projects/:projectId', async (request, reply) => { try { const projectId = Number((request.params as { projectId: string }).projectId); const project = updateProject(projectId, request.body); if (!project) { reply.code(404); return { detail: 'Project not found' }; } return project; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.delete('/projects/:projectId', async (request, reply) => { const projectId = Number((request.params as { projectId: string }).projectId); const result = deleteProject(projectId); if (!result.ok) { reply.code(result.status); return { detail: result.detail }; } reply.code(204); return null; });

  app.get('/demands-api', async () => listDemands());
  app.post('/demands-api', async (request, reply) => { try { const demand = createDemand(request.body); reply.code(201); return demand; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.put('/demands-api/:demandId', async (request, reply) => { try { const demandId = Number((request.params as { demandId: string }).demandId); const demand = updateDemand(demandId, request.body); if (!demand) { reply.code(404); return { detail: 'Demand not found' }; } return demand; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.delete('/demands-api/:demandId', async (request, reply) => { const demandId = Number((request.params as { demandId: string }).demandId); const result = deleteDemand(demandId); if (!result.ok) { reply.code(result.status); return { detail: result.detail }; } reply.code(204); return null; });

  app.get('/assignments', async () => listAssignments());
  app.get('/schedule/employee/:employeeId', async (request, reply) => { const employeeId = Number((request.params as { employeeId: string }).employeeId); const schedule = listEmployeeSchedule(employeeId); if (!schedule) { reply.code(404); return { detail: 'Employee not found' }; } return schedule; });
  app.get('/schedule/project/:projectId', async (request, reply) => { const projectId = Number((request.params as { projectId: string }).projectId); const schedule = listProjectSchedule(projectId); if (!schedule) { reply.code(404); return { detail: 'Project not found' }; } return schedule; });
  app.post('/assignments', async (request, reply) => { try { const assignment = createAssignment(request.body); reply.code(201); return assignment; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.put('/assignments/:assignmentId', async (request, reply) => { try { const assignmentId = Number((request.params as { assignmentId: string }).assignmentId); const assignment = updateAssignment(assignmentId, request.body); if (!assignment) { reply.code(404); return { detail: 'Assignment not found' }; } return assignment; } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.delete('/assignments/:assignmentId', async (request, reply) => { const assignmentId = Number((request.params as { assignmentId: string }).assignmentId); const result = deleteAssignment(assignmentId); if (!result.ok) { reply.code(result.status); return { detail: result.detail }; } reply.code(204); return null; });

  app.get('/dashboard-api', async (request, reply) => getDashboardData((request.headers['x-matrix-user'] as string) || 'demo'));
  app.put('/dashboard-api/tracked-employees', async (request, reply) => { try { return updateDashboardTrackedEmployees((request.headers['x-matrix-user'] as string) || 'demo', request.body); } catch (error) { const formatted = formatWorkforceError(error); reply.code(formatted.statusCode); return { detail: formatted.detail }; } });
  app.get('/forecast-api', async () => getForecastData());
};

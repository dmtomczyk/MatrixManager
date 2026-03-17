import { createOrganization, createJobCode, createEmployee, createProject, createDemand, createAssignment, updateDashboardTrackedEmployees } from '../src/features/workforce/service.js';
import { addAuditEntry, createUser } from '../src/features/admin/service.js';
import { getConfig } from '../src/config.js';
import { workforceStore } from '../src/features/workforce/store.js';
import { adminStore } from '../src/features/admin/store.js';

function resetTsState() {
  workforceStore.write({
    organizations: [],
    jobCodes: [],
    employees: [],
    projects: [],
    demands: [],
    assignments: [],
    dashboard: {}
  });

  adminStore.write({
    users: [],
    profiles: {},
    inbox: {},
    audit: [],
    dbConnections: []
  });
}

resetTsState();

const config = getConfig();
const actor = config.authUsername;

const engineering = createOrganization({ name: 'Engineering', description: 'Product engineering' });
const product = createOrganization({ name: 'Product', description: 'Product and design' });
const operations = createOrganization({ name: 'Operations', description: 'Business operations' });

const executive = createJobCode({ name: 'Executive', is_leader: true });
const engineeringDirectorCode = createJobCode({ name: 'Engineering Director', is_leader: true });
const productDirectorCode = createJobCode({ name: 'Product Director', is_leader: true });
const engineeringManagerCode = createJobCode({ name: 'Engineering Manager', is_leader: true });
const productManagerCode = createJobCode({ name: 'Product Manager', is_leader: true });
const backendEngineerCode = createJobCode({ name: 'Backend Engineer', is_leader: false });
const frontendEngineerCode = createJobCode({ name: 'Frontend Engineer', is_leader: false });
const designerCode = createJobCode({ name: 'Product Designer', is_leader: false });

const ceo = createEmployee({ name: 'Alex CEO', job_code_id: executive.id, organization_id: operations.id, manager_id: null, role: 'Chief Executive Officer', location: 'HQ', capacity: 1 });
const engDirector = createEmployee({ name: 'Blair Eng Director', job_code_id: engineeringDirectorCode.id, organization_id: engineering.id, manager_id: ceo.id, role: 'Director of Engineering', location: 'Remote', capacity: 1 });
const productDirector = createEmployee({ name: 'Casey Product Director', job_code_id: productDirectorCode.id, organization_id: product.id, manager_id: ceo.id, role: 'Director of Product', location: 'NYC', capacity: 1 });
const engineeringManager = createEmployee({ name: 'Devon Engineering Manager', job_code_id: engineeringManagerCode.id, organization_id: engineering.id, manager_id: engDirector.id, role: 'Engineering Manager', location: 'Remote', capacity: 1 });
const productManager = createEmployee({ name: 'Emery Product Manager', job_code_id: productManagerCode.id, organization_id: product.id, manager_id: productDirector.id, role: 'Product Manager', location: 'Remote', capacity: 1 });
const backendEngineer = createEmployee({ name: 'Fin Backend Engineer', job_code_id: backendEngineerCode.id, organization_id: engineering.id, manager_id: engineeringManager.id, role: 'Backend Engineer', location: 'Remote', capacity: 1 });
const frontendEngineer = createEmployee({ name: 'Gray Frontend Engineer', job_code_id: frontendEngineerCode.id, organization_id: engineering.id, manager_id: engineeringManager.id, role: 'Frontend Engineer', location: 'NYC', capacity: 1 });
const productDesigner = createEmployee({ name: 'Harper Product Designer', job_code_id: designerCode.id, organization_id: product.id, manager_id: productManager.id, role: 'Designer', location: 'Remote', capacity: 0.8 });

const phoenix = createProject({ name: 'Phoenix Platform', description: 'Platform modernization', start_date: '2026-03-01', end_date: '2026-06-30' });
const atlas = createProject({ name: 'Atlas Launch', description: 'New product launch', start_date: '2026-03-15', end_date: '2026-05-15' });
const opsDashboard = createProject({ name: 'Ops Dashboard', description: 'Internal tooling refresh', start_date: '2026-04-01', end_date: '2026-07-01' });

const phoenixDemand = createDemand({ project_id: phoenix.id, title: 'Platform backend modernization', organization_id: engineering.id, job_code_id: backendEngineerCode.id, skill_notes: 'API and data migration work', start_date: '2026-03-01', end_date: '2026-05-15', required_allocation: 1, notes: 'Core backend demand' });
const atlasUiDemand = createDemand({ project_id: atlas.id, title: 'Launch UI buildout', organization_id: engineering.id, job_code_id: frontendEngineerCode.id, skill_notes: 'Frontend + launch UI', start_date: '2026-03-15', end_date: '2026-05-01', required_allocation: 0.5, notes: 'Frontend launch demand' });
const atlasDesignDemand = createDemand({ project_id: atlas.id, title: 'Design support', organization_id: product.id, job_code_id: designerCode.id, skill_notes: 'Product design support', start_date: '2026-03-15', end_date: '2026-05-15', required_allocation: 0.8, notes: 'Design staffing demand' });
const opsTechnicalDemand = createDemand({ project_id: opsDashboard.id, title: 'Technical oversight', organization_id: engineering.id, job_code_id: engineeringManagerCode.id, skill_notes: 'Architecture + oversight', start_date: '2026-04-01', end_date: '2026-06-01', required_allocation: 0.25, notes: 'Manager support demand' });

createAssignment({ employee_id: backendEngineer.id, project_id: phoenix.id, demand_id: phoenixDemand.id, start_date: '2026-03-01', end_date: '2026-04-15', allocation: 0.75, notes: 'Core backend work' });
createAssignment({ employee_id: frontendEngineer.id, project_id: phoenix.id, demand_id: null, start_date: '2026-03-01', end_date: '2026-04-30', allocation: 0.5, notes: 'Frontend migration' });
createAssignment({ employee_id: frontendEngineer.id, project_id: atlas.id, demand_id: atlasUiDemand.id, start_date: '2026-03-15', end_date: '2026-05-01', allocation: 0.5, notes: 'Launch UI' });
createAssignment({ employee_id: productDesigner.id, project_id: atlas.id, demand_id: atlasDesignDemand.id, start_date: '2026-03-15', end_date: '2026-05-15', allocation: 0.8, notes: 'Design support' });
createAssignment({ employee_id: engineeringManager.id, project_id: opsDashboard.id, demand_id: opsTechnicalDemand.id, start_date: '2026-04-01', end_date: '2026-06-01', allocation: 0.25, notes: 'Technical oversight' });

createUser({ username: 'manager', password: 'manager', employee_id: engineeringManager.id, is_admin: true });
updateDashboardTrackedEmployees(actor, { employee_ids: [engineeringManager.id, backendEngineer.id, frontendEngineer.id] });

addAuditEntry({
  actor,
  action: 'seed',
  entity_type: 'system',
  entity_id: 'sample-data',
  summary: 'Seeded TS sample data',
  before_json: null,
  after_json: JSON.stringify({ organizations: 3, employees: 8, projects: 3, demands: 4, assignments: 5 })
});

console.log('Seeded TS sample data: 3 organizations, 8 employees, 3 projects, 4 demands, 5 assignments.');
console.log('Created TS-managed sample user: manager / manager');

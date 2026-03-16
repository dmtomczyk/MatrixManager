import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';

const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  if (response.status === 204) return null;
  return response.json();
};

const formatDate = (value) => value || '—';
const formatPct = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
const todayIso = () => new Date().toISOString().split('T')[0];

function EmployeeNode({ data }) {
  return (
    <div className={`rf-card rf-card-employee${data.over ? ' is-over' : ''}`}>
      <div className="rf-card-title">{data.label}</div>
      <div className="rf-card-meta">{data.role || data.employeeType || 'Employee'}</div>
      <div className="rf-card-meta">{formatPct(data.allocation)} allocated · {formatPct(data.capacity)} cap</div>
    </div>
  );
}

function ProjectNode({ data }) {
  return (
    <div className="rf-card rf-card-project">
      <div className="rf-card-title">{data.label}</div>
      <div className="rf-card-meta">{formatDate(data.startDate)} → {formatDate(data.endDate)}</div>
      <div className="rf-card-meta">{Number(data.activeFte || 0).toFixed(2)} FTE active</div>
    </div>
  );
}

function OrgNode({ data }) {
  return (
    <div className="rf-card rf-card-org">
      <div className="rf-card-title">{data.label}</div>
      <div className="rf-card-meta">{data.description || `${data.count || 0} employees`}</div>
    </div>
  );
}

const nodeTypes = {
  employee: EmployeeNode,
  project: ProjectNode,
  organization: OrgNode,
};

const getCurrentAllocation = (employeeId, assignments) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return assignments.reduce((sum, asg) => {
    if (asg.employee_id !== employeeId) return sum;
    const start = new Date(asg.start_date);
    const end = new Date(asg.end_date);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return sum;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return start <= now && end >= now ? sum + (asg.allocation || 0) : sum;
  }, 0);
};

const buildGraph = ({ organizations, employees, projects, assignments }) => {
  const nodes = [];
  const edges = [];
  const laneX = 60;
  const laneWidth = 250;
  const employeeStartX = 360;
  const employeeDepthX = 230;
  const projectStartX = 980;
  const projectWidth = 260;
  const laneTop = 50;
  const laneGap = 42;
  const employeeGapY = 100;
  const projectGapY = 180;

  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  let currentLaneY = laneTop;
  organizations.forEach((org) => {
    const orgEmployees = employees.filter((employee) => employee.organization_id === org.id).sort((a, b) => a.name.localeCompare(b.name));
    const byManager = new Map();
    orgEmployees.forEach((employee) => byManager.set(employee.id, []));
    orgEmployees.forEach((employee) => {
      if (employee.manager_id && byManager.has(employee.manager_id)) byManager.get(employee.manager_id).push(employee);
    });
    byManager.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    const roots = orgEmployees.filter((employee) => !employee.manager_id || !employeeById.has(employee.manager_id) || employeeById.get(employee.manager_id)?.organization_id !== org.id);

    let cursor = currentLaneY + 90;
    const positions = new Map();
    const layout = (employee, depth = 0) => {
      const reports = byManager.get(employee.id) || [];
      if (!reports.length) {
        const y = cursor;
        positions.set(employee.id, { x: employeeStartX + depth * employeeDepthX, y });
        cursor += employeeGapY;
        return y;
      }
      const childYs = reports.map((report) => layout(report, depth + 1));
      const y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
      positions.set(employee.id, { x: employeeStartX + depth * employeeDepthX, y });
      return y;
    };
    roots.forEach((root) => {
      layout(root, 0);
      cursor += 20;
    });

    const laneHeight = Math.max(200, cursor - currentLaneY + 10);
    nodes.push({
      id: `org-${org.id}`,
      type: 'organization',
      draggable: false,
      selectable: true,
      position: { x: laneX, y: currentLaneY },
      data: { label: org.name, description: org.description, count: orgEmployees.length },
      style: { width: laneWidth },
    });

    orgEmployees.forEach((employee) => {
      const pos = positions.get(employee.id) || { x: employeeStartX, y: currentLaneY + 100 };
      const allocation = getCurrentAllocation(employee.id, assignments);
      nodes.push({
        id: `employee-${employee.id}`,
        type: 'employee',
        position: pos,
        data: {
          label: employee.name,
          role: employee.role,
          employeeType: employee.employee_type,
          allocation,
          capacity: employee.capacity || 1,
          over: allocation > (employee.capacity || 1),
          employeeId: employee.id,
        },
      });
      if (employee.manager_id && employeeById.has(employee.manager_id)) {
        edges.push({
          id: `manager-${employee.manager_id}-${employee.id}`,
          source: `employee-${employee.manager_id}`,
          target: `employee-${employee.id}`,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          selectable: false,
          data: { relation: 'manager' },
        });
      }
    });

    currentLaneY += laneHeight + laneGap;
  });

  projects.forEach((project, index) => {
    const y = laneTop + index * projectGapY;
    const projectAssignments = assignments.filter((asg) => asg.project_id === project.id);
    const activeFte = projectAssignments.reduce((sum, asg) => sum + (asg.allocation || 0), 0);
    nodes.push({
      id: `project-${project.id}`,
      type: 'project',
      position: { x: projectStartX, y },
      data: {
        label: project.name,
        startDate: project.start_date,
        endDate: project.end_date,
        activeFte,
        projectId: project.id,
      },
      style: { width: projectWidth },
    });
  });

  assignments.forEach((asg) => {
    if (!employeeById.has(asg.employee_id)) return;
    edges.push({
      id: `assignment-${asg.id}`,
      source: `employee-${asg.employee_id}`,
      target: `project-${asg.project_id}`,
      type: 'bezier',
      animated: false,
      style: { stroke: '#2563eb', strokeWidth: 3 },
      label: formatPct(asg.allocation),
      data: { relation: 'assignment', assignmentId: asg.id },
    });
  });

  return { nodes, edges };
};

export default function CanvasApp() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ organizations: [], employees: [], projects: [], assignments: [] });
  const [toast, setToast] = useState('');
  const [orgFormOpen, setOrgFormOpen] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: '', description: '' });
  const [assignmentDefaults, setAssignmentDefaults] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [organizations, employees, projects, assignments] = await Promise.all([
        apiFetch('/organizations'),
        apiFetch('/employees'),
        apiFetch('/projects'),
        apiFetch('/assignments'),
      ]);
      setData({ organizations, employees, projects, assignments });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const graph = useMemo(() => buildGraph(data), [data]);
  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const onConnect = useCallback(async (params) => {
    const source = params.source || '';
    const target = params.target || '';
    if (source.startsWith('employee-') && target.startsWith('project-')) {
      const employeeId = Number(source.replace('employee-', ''));
      const projectId = Number(target.replace('project-', ''));
      setAssignmentDefaults({ employeeId, projectId, start_date: todayIso(), end_date: todayIso(), allocation: 100, notes: '' });
      return;
    }
    if (source.startsWith('employee-') && target.startsWith('employee-')) {
      const employeeId = Number(source.replace('employee-', ''));
      const managerId = Number(target.replace('employee-', ''));
      if (employeeId === managerId) return;
      try {
        await apiFetch(`/employees/${employeeId}`, { method: 'PUT', body: JSON.stringify({ manager_id: managerId }) });
        setToast('Manager link updated');
        await refresh();
      } catch (err) {
        setError(err.message);
      }
      return;
    }
    setEdges((eds) => addEdge(params, eds));
  }, [refresh, setEdges]);

  const onNodeDragStop = useCallback(async (_event, node) => {
    if (!node?.id?.startsWith('employee-')) return;
    const employeeId = Number(node.id.replace('employee-', ''));
    const nearestOrg = data.organizations
      .map((orgNode) => nodes.find((n) => n.id === `org-${orgNode.id}`))
      .filter(Boolean)
      .map((orgNode) => ({ orgId: Number(orgNode.id.replace('org-', '')), x: orgNode.position.x, y: orgNode.position.y }))
      .sort((a, b) => Math.abs(a.y - node.position.y) - Math.abs(b.y - node.position.y))[0];
    if (!nearestOrg) return;
    const employee = data.employees.find((emp) => emp.id === employeeId);
    if (!employee || employee.organization_id === nearestOrg.orgId) return;
    try {
      await apiFetch(`/employees/${employeeId}`, { method: 'PUT', body: JSON.stringify({ organization_id: nearestOrg.orgId }) });
      setToast(`${employee.name} moved to ${data.organizations.find((org) => org.id === nearestOrg.orgId)?.name || 'organization'}`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }, [data, nodes, refresh]);

  const submitOrgForm = async (event) => {
    event.preventDefault();
    try {
      await apiFetch('/organizations', { method: 'POST', body: JSON.stringify({ name: orgForm.name.trim(), description: orgForm.description.trim() || null }) });
      setOrgForm({ name: '', description: '' });
      setOrgFormOpen(false);
      setToast('Organization created');
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const submitAssignment = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(form.get('employee_id')),
          project_id: Number(form.get('project_id')),
          start_date: form.get('start_date'),
          end_date: form.get('end_date'),
          allocation: (Number(form.get('allocation')) || 0) / 100,
          notes: String(form.get('notes') || '').trim() || null,
        }),
      });
      setAssignmentDefaults(null);
      setToast('Assignment created');
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="canvas-react-shell">
      <div className="canvas-react-toolbar">
        <div>
          <h2>React Canvas</h2>
          <p>Incremental rewrite of the canvas using React Flow. Connect employee → employee for manager links and employee → project for assignments.</p>
        </div>
        <div className="canvas-react-actions">
          <button type="button" className="ghost-button" onClick={() => setOrgFormOpen(true)}>Create New Org</button>
          <button type="button" className="ghost-button" onClick={refresh}>Refresh</button>
        </div>
      </div>

      {error ? <div className="canvas-react-banner is-error">{error}</div> : null}
      {toast ? <div className="canvas-react-banner is-toast">{toast}</div> : null}

      <div className="canvas-react-stage">
        {loading ? <div className="canvas-react-loading">Loading canvas…</div> : null}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          defaultEdgeOptions={{ type: 'bezier' }}
          connectionLineStyle={{ stroke: '#2563eb', strokeWidth: 3 }}
          snapToGrid
          snapGrid={[16, 16]}
        >
          <Background gap={24} size={1} color="#dbe3ee" />
          <MiniMap pannable zoomable nodeStrokeWidth={3} />
          <Controls />
          <Panel position="top-right" className="canvas-react-panel">
            <div><strong>{data.organizations.length}</strong> orgs</div>
            <div><strong>{data.employees.length}</strong> employees</div>
            <div><strong>{data.projects.length}</strong> projects</div>
            <div><strong>{data.assignments.length}</strong> assignments</div>
          </Panel>
        </ReactFlow>
      </div>

      {orgFormOpen ? (
        <div className="canvas-react-modal-backdrop" onClick={() => setOrgFormOpen(false)}>
          <div className="canvas-react-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create organization</h3>
            <form onSubmit={submitOrgForm} className="canvas-react-form">
              <label>Name<input value={orgForm.name} onChange={(event) => setOrgForm((prev) => ({ ...prev, name: event.target.value }))} required /></label>
              <label>Description<textarea rows={3} value={orgForm.description} onChange={(event) => setOrgForm((prev) => ({ ...prev, description: event.target.value }))} /></label>
              <div className="canvas-react-form-actions">
                <button type="button" className="ghost-button" onClick={() => setOrgFormOpen(false)}>Cancel</button>
                <button type="submit">Create organization</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {assignmentDefaults ? (
        <div className="canvas-react-modal-backdrop" onClick={() => setAssignmentDefaults(null)}>
          <div className="canvas-react-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create assignment</h3>
            <form onSubmit={submitAssignment} className="canvas-react-form">
              <label>
                Employee
                <select name="employee_id" defaultValue={assignmentDefaults.employeeId}>
                  {data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                </select>
              </label>
              <label>
                Project
                <select name="project_id" defaultValue={assignmentDefaults.projectId}>
                  {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              <label>Start Date<input type="date" name="start_date" defaultValue={assignmentDefaults.start_date} required /></label>
              <label>End Date<input type="date" name="end_date" defaultValue={assignmentDefaults.end_date} required /></label>
              <label>Allocation (%)<input type="number" name="allocation" min="1" max="100" defaultValue={assignmentDefaults.allocation} required /></label>
              <label>Notes<textarea rows={3} name="notes" defaultValue={assignmentDefaults.notes} /></label>
              <div className="canvas-react-form-actions">
                <button type="button" className="ghost-button" onClick={() => setAssignmentDefaults(null)}>Cancel</button>
                <button type="submit">Create assignment</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

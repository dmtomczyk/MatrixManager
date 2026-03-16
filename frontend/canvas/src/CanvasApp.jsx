import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  MarkerType,
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
    <div className={`rf-card rf-card-employee${data.over ? ' is-over' : ''}${data.isSelected ? ' is-selected' : ''}`}>
      <div className="rf-card-title">{data.label}</div>
      <div className="rf-card-meta">{data.role || data.employeeType || 'Employee'}</div>
      <div className="rf-card-meta">{formatPct(data.allocation)} allocated · {formatPct(data.capacity)} cap</div>
      {data.organizationName ? <div className="rf-card-meta">{data.organizationName}</div> : null}
    </div>
  );
}

function ProjectNode({ data }) {
  return (
    <div className={`rf-card rf-card-project${data.isSelected ? ' is-selected' : ''}`}>
      <div className="rf-card-title">{data.label}</div>
      <div className="rf-card-meta">{formatDate(data.startDate)} → {formatDate(data.endDate)}</div>
      <div className="rf-card-meta">{Number(data.activeFte || 0).toFixed(2)} FTE active</div>
      <div className="rf-card-meta">{data.assignmentCount || 0} assignment{data.assignmentCount === 1 ? '' : 's'}</div>
    </div>
  );
}

function OrgNode({ data }) {
  return (
    <div className={`rf-card rf-card-org${data.isSelected ? ' is-selected' : ''}`}>
      <div className="rf-card-title">{data.label}</div>
      <div className="rf-card-meta">{data.description || `${data.count || 0} employees`}</div>
      <div className="rf-card-meta">Drag employees into this lane to reassign org</div>
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

const buildHierarchy = (employees) => {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const directReports = new Map(employees.map((employee) => [employee.id, []]));
  const roots = [];
  employees.forEach((employee) => {
    if (employee.manager_id && byId.has(employee.manager_id)) directReports.get(employee.manager_id).push(employee);
    else roots.push(employee);
  });
  const sortList = (list) => list.sort((a, b) => a.name.localeCompare(b.name));
  sortList(roots);
  directReports.forEach(sortList);
  return { roots, directReports };
};

const buildGraph = ({ organizations, employees, projects, assignments, selectedNodeId, orgFilter }) => {
  const nodes = [];
  const edges = [];
  const orgLaneWidth = 280;
  const employeeStartX = 360;
  const employeeDepthX = 240;
  const projectStartX = 1000;
  const projectWidth = 280;
  const laneTop = 60;
  const laneGap = 48;
  const employeeGapY = 98;
  const projectGapY = 190;
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const visibleOrganizations = organizations.filter((org) => !orgFilter || String(org.id) === String(orgFilter));

  let currentLaneY = laneTop;
  visibleOrganizations.forEach((org) => {
    const orgEmployees = employees
      .filter((employee) => employee.organization_id === org.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    const { roots, directReports } = buildHierarchy(orgEmployees);
    const positions = new Map();
    let cursor = currentLaneY + 96;

    const layout = (employee, depth = 0) => {
      const reports = directReports.get(employee.id) || [];
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
      cursor += 24;
    });

    const laneHeight = Math.max(220, cursor - currentLaneY);
    nodes.push({
      id: `org-${org.id}`,
      type: 'organization',
      draggable: false,
      selectable: true,
      position: { x: 60, y: currentLaneY },
      data: {
        label: org.name,
        description: org.description,
        count: orgEmployees.length,
        isSelected: selectedNodeId === `org-${org.id}`,
      },
      style: { width: orgLaneWidth },
    });

    orgEmployees.forEach((employee) => {
      const position = positions.get(employee.id) || { x: employeeStartX, y: currentLaneY + 100 };
      const allocation = getCurrentAllocation(employee.id, assignments);
      nodes.push({
        id: `employee-${employee.id}`,
        type: 'employee',
        position,
        draggable: true,
        data: {
          label: employee.name,
          role: employee.role,
          employeeType: employee.employee_type,
          allocation,
          capacity: employee.capacity || 1,
          over: allocation > (employee.capacity || 1),
          employeeId: employee.id,
          organizationName: employee.organization_name,
          isSelected: selectedNodeId === `employee-${employee.id}`,
        },
      });

      if (employee.manager_id && employeeById.has(employee.manager_id) && orgEmployees.some((candidate) => candidate.id === employee.manager_id)) {
        edges.push({
          id: `manager-${employee.manager_id}-${employee.id}`,
          source: `employee-${employee.manager_id}`,
          target: `employee-${employee.id}`,
          type: 'smoothstep',
          selectable: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          data: { relation: 'manager', employeeId: employee.id, managerId: employee.manager_id },
        });
      }
    });

    currentLaneY += laneHeight + laneGap;
  });

  projects.forEach((project, index) => {
    const y = laneTop + index * projectGapY;
    const projectAssignments = assignments.filter((asg) => asg.project_id === project.id);
    nodes.push({
      id: `project-${project.id}`,
      type: 'project',
      position: { x: projectStartX, y },
      draggable: true,
      data: {
        label: project.name,
        startDate: project.start_date,
        endDate: project.end_date,
        activeFte: projectAssignments.reduce((sum, asg) => sum + (asg.allocation || 0), 0),
        assignmentCount: projectAssignments.length,
        projectId: project.id,
        isSelected: selectedNodeId === `project-${project.id}`,
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
      selectable: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#2563eb' },
      style: { stroke: '#2563eb', strokeWidth: 3 },
      label: formatPct(asg.allocation),
      data: { relation: 'assignment', assignmentId: asg.id },
      labelStyle: { fill: '#1d4ed8', fontWeight: 700 },
      labelBgStyle: { fill: '#eff6ff', fillOpacity: 0.94 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 999,
    });
  });

  return { nodes, edges };
};

const defaultProjectForm = { name: '', description: '', start_date: '', end_date: '' };
const defaultEmployeeForm = { name: '', role: '', employee_type: 'IC', manager_id: '', location: '', capacity: 1 };
const defaultAssignmentForm = { employee_id: '', project_id: '', start_date: todayIso(), end_date: todayIso(), allocation: 100, notes: '' };

export default function CanvasApp() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ organizations: [], employees: [], projects: [], assignments: [] });
  const [toast, setToast] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [orgFormOpen, setOrgFormOpen] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: '', description: '' });
  const [projectFormState, setProjectFormState] = useState({ open: false, projectId: null, values: defaultProjectForm });
  const [employeeFormState, setEmployeeFormState] = useState({ open: false, employeeId: null, values: defaultEmployeeForm });
  const [assignmentFormState, setAssignmentFormState] = useState({ open: false, values: defaultAssignmentForm });
  const [removeAssignmentState, setRemoveAssignmentState] = useState({ open: false, assignmentId: '' });
  const [projectTimeline, setProjectTimeline] = useState(null);
  const flowWrapperRef = useRef(null);

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

  const graph = useMemo(() => buildGraph({ ...data, selectedNodeId, orgFilter }), [data, selectedNodeId, orgFilter]);
  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const openCreateProject = () => setProjectFormState({ open: true, projectId: null, values: { ...defaultProjectForm } });
  const openEditProject = (projectId = null) => {
    const project = data.projects.find((item) => item.id === projectId) || (projectId == null && selectedNodeId.startsWith('project-') ? data.projects.find((item) => item.id === Number(selectedNodeId.replace('project-', ''))) : null);
    setProjectFormState({
      open: true,
      projectId: project?.id || null,
      values: project ? { name: project.name || '', description: project.description || '', start_date: project.start_date || '', end_date: project.end_date || '' } : { ...defaultProjectForm },
    });
  };
  const openEditEmployee = (employeeId = null) => {
    const employee = data.employees.find((item) => item.id === employeeId) || (employeeId == null && selectedNodeId.startsWith('employee-') ? data.employees.find((item) => item.id === Number(selectedNodeId.replace('employee-', ''))) : null);
    setEmployeeFormState({
      open: true,
      employeeId: employee?.id || null,
      values: employee ? {
        name: employee.name || '',
        role: employee.role || '',
        employee_type: employee.employee_type || 'IC',
        manager_id: employee.manager_id || '',
        location: employee.location || '',
        capacity: employee.capacity || 1,
      } : { ...defaultEmployeeForm },
    });
  };
  const openCreateAssignment = (employeeId = '', projectId = '') => setAssignmentFormState({
    open: true,
    values: {
      ...defaultAssignmentForm,
      employee_id: employeeId || (selectedNodeId.startsWith('employee-') ? Number(selectedNodeId.replace('employee-', '')) : ''),
      project_id: projectId || (selectedNodeId.startsWith('project-') ? Number(selectedNodeId.replace('project-', '')) : ''),
    },
  });

  const selectedEmployee = selectedNodeId.startsWith('employee-') ? data.employees.find((employee) => employee.id === Number(selectedNodeId.replace('employee-', ''))) : null;
  const selectedProject = selectedNodeId.startsWith('project-') ? data.projects.find((project) => project.id === Number(selectedNodeId.replace('project-', ''))) : null;

  const onConnect = useCallback(async (params) => {
    const source = params.source || '';
    const target = params.target || '';
    if (source.startsWith('employee-') && target.startsWith('project-')) {
      openCreateAssignment(Number(source.replace('employee-', '')), Number(target.replace('project-', '')));
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
    }
  }, [refresh]);

  const onNodeDragStop = useCallback(async (_event, node) => {
    if (!node?.id?.startsWith('employee-')) return;
    const employeeId = Number(node.id.replace('employee-', ''));
    const orgNodes = nodes.filter((item) => item.id.startsWith('org-'));
    const nearestOrg = orgNodes
      .map((orgNode) => ({ orgId: Number(orgNode.id.replace('org-', '')), yDistance: Math.abs(orgNode.position.y - node.position.y) }))
      .sort((a, b) => a.yDistance - b.yDistance)[0];
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

  const onNodeClick = (_event, node) => {
    setSelectedEdge(null);
    setSelectedNodeId(node.id);
  };

  const onEdgeClick = (_event, edge) => {
    setSelectedNodeId('');
    setSelectedEdge(edge);
  };

  const onPaneClick = () => {
    setSelectedNodeId('');
    setSelectedEdge(null);
    setContextMenu(null);
  };

  const onContextMenu = (event) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  };

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

  const submitProjectForm = async (event) => {
    event.preventDefault();
    const payload = { ...projectFormState.values, description: projectFormState.values.description || null, start_date: projectFormState.values.start_date || null, end_date: projectFormState.values.end_date || null };
    try {
      if (projectFormState.projectId) await apiFetch(`/projects/${projectFormState.projectId}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await apiFetch('/projects', { method: 'POST', body: JSON.stringify(payload) });
      setProjectFormState({ open: false, projectId: null, values: defaultProjectForm });
      setToast(projectFormState.projectId ? 'Project updated' : 'Project created');
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const submitEmployeeForm = async (event) => {
    event.preventDefault();
    if (!employeeFormState.employeeId) return;
    const values = employeeFormState.values;
    try {
      await apiFetch(`/employees/${employeeFormState.employeeId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: values.name,
          role: values.role || null,
          employee_type: values.employee_type,
          location: values.location || null,
          capacity: Number(values.capacity) || 1,
          manager_id: values.manager_id ? Number(values.manager_id) : null,
        }),
      });
      setEmployeeFormState({ open: false, employeeId: null, values: defaultEmployeeForm });
      setToast('Employee updated');
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const submitAssignmentForm = async (event) => {
    event.preventDefault();
    const values = assignmentFormState.values;
    try {
      await apiFetch('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(values.employee_id),
          project_id: Number(values.project_id),
          start_date: values.start_date,
          end_date: values.end_date,
          allocation: (Number(values.allocation) || 0) / 100,
          notes: values.notes || null,
        }),
      });
      setAssignmentFormState({ open: false, values: defaultAssignmentForm });
      setToast('Assignment created');
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteSelectedAssignment = async (assignmentId) => {
    try {
      await apiFetch(`/assignments/${assignmentId}`, { method: 'DELETE' });
      setRemoveAssignmentState({ open: false, assignmentId: '' });
      setSelectedEdge(null);
      setToast('Assignment removed');
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const openProjectTimeline = (project) => {
    const assignments = data.assignments.filter((asg) => asg.project_id === project.id);
    setProjectTimeline({ project, assignments });
  };

  const orgOptions = useMemo(() => data.organizations.map((org) => ({ value: String(org.id), label: org.name })), [data.organizations]);
  const assignmentChoices = useMemo(() => data.assignments.map((asg) => ({ id: asg.id, label: `${data.employees.find((emp) => emp.id === asg.employee_id)?.name || 'Employee'} → ${data.projects.find((proj) => proj.id === asg.project_id)?.name || 'Project'}` })), [data]);

  return (
    <main className="canvas-react-shell">
      <div className="canvas-react-toolbar">
        <div>
          <h2>Canvas</h2>
          <p>React Flow rewrite-in-progress. Core canvas flows now live here while the legacy canvas code remains parked until we reach full confidence.</p>
        </div>
        <div className="canvas-react-actions">
          <label className="canvas-react-inline-filter">Organization
            <select value={orgFilter} onChange={(event) => setOrgFilter(event.target.value)}>
              <option value="">All</option>
              {orgOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" className="ghost-button" onClick={() => setOrgFormOpen(true)}>Create New Org</button>
          <button type="button" className="ghost-button" onClick={openCreateProject}>Create Project</button>
          <button type="button" className="ghost-button" onClick={refresh}>Refresh</button>
        </div>
      </div>

      {error ? <div className="canvas-react-banner is-error">{error}</div> : null}
      {toast ? <div className="canvas-react-banner is-toast">{toast}</div> : null}

      <div className="canvas-react-layout">
        <aside className="canvas-react-sidebar">
          <section className="canvas-react-sidecard">
            <div className="section-head">
              <h3>Employees</h3>
              <p>Click to focus. Connect employee → employee for manager links or employee → project for assignments.</p>
            </div>
            <div className="canvas-react-resource-list">
              {data.employees
                .filter((employee) => !orgFilter || String(employee.organization_id) === String(orgFilter))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    className={`canvas-react-resource${selectedNodeId === `employee-${employee.id}` ? ' is-selected' : ''}`}
                    onClick={() => {
                      setSelectedEdge(null);
                      setSelectedNodeId(`employee-${employee.id}`);
                    }}
                  >
                    <strong>{employee.name}</strong>
                    <span>{employee.organization_name || 'No org'} · {employee.role || employee.employee_type || 'Employee'}</span>
                  </button>
                ))}
            </div>
          </section>

          <section className="canvas-react-sidecard">
            <div className="section-head">
              <h3>Inspector</h3>
              <p>Selected node or edge actions.</p>
            </div>
            {selectedEmployee ? (
              <div className="canvas-react-inspector">
                <strong>{selectedEmployee.name}</strong>
                <span>{selectedEmployee.organization_name || 'No organization'}</span>
                <span>{selectedEmployee.role || selectedEmployee.employee_type || 'Employee'}</span>
                <div className="canvas-react-inspector-actions">
                  <button type="button" className="ghost-button" onClick={() => openEditEmployee(selectedEmployee.id)}>Edit Employee</button>
                  <button type="button" className="ghost-button" onClick={() => openCreateAssignment(selectedEmployee.id, '')}>Add Assignment</button>
                </div>
              </div>
            ) : null}
            {selectedProject ? (
              <div className="canvas-react-inspector">
                <strong>{selectedProject.name}</strong>
                <span>{formatDate(selectedProject.start_date)} → {formatDate(selectedProject.end_date)}</span>
                <div className="canvas-react-inspector-actions">
                  <button type="button" className="ghost-button" onClick={() => openEditProject(selectedProject.id)}>Edit Project</button>
                  <button type="button" className="ghost-button" onClick={() => openProjectTimeline(selectedProject)}>Show Details</button>
                </div>
              </div>
            ) : null}
            {selectedEdge ? (
              <div className="canvas-react-inspector">
                <strong>{selectedEdge.data?.relation === 'assignment' ? 'Assignment edge' : 'Manager edge'}</strong>
                {selectedEdge.data?.relation === 'assignment' ? (
                  <button type="button" className="ghost-button" onClick={() => setRemoveAssignmentState({ open: true, assignmentId: String(selectedEdge.data.assignmentId) })}>Remove Assignment</button>
                ) : null}
              </div>
            ) : null}
            {!selectedEmployee && !selectedProject && !selectedEdge ? <p className="muted">Nothing selected.</p> : null}
          </section>
        </aside>

        <section className="canvas-react-stage" ref={flowWrapperRef} onContextMenu={onContextMenu}>
          {loading ? <div className="canvas-react-loading">Loading canvas…</div> : null}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.12 }}
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

          {contextMenu ? (
            <div className="canvas-react-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
              <button type="button" onClick={() => { setContextMenu(null); setOrgFormOpen(true); }}>Create New Org</button>
              <button type="button" onClick={() => { setContextMenu(null); openCreateProject(); }}>Create Project</button>
              <button type="button" onClick={() => { setContextMenu(null); openEditProject(); }}>Edit Project</button>
              <hr />
              <button type="button" onClick={() => { setContextMenu(null); openCreateAssignment(); }}>Add Assignment</button>
              <button type="button" onClick={() => { setContextMenu(null); setRemoveAssignmentState({ open: true, assignmentId: assignmentChoices[0]?.id ? String(assignmentChoices[0].id) : '' }); }}>Remove Assignment</button>
              <hr />
              <button type="button" onClick={() => { setContextMenu(null); openEditEmployee(); }}>Edit Employee</button>
            </div>
          ) : null}
        </section>
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

      {projectFormState.open ? (
        <div className="canvas-react-modal-backdrop" onClick={() => setProjectFormState({ open: false, projectId: null, values: defaultProjectForm })}>
          <div className="canvas-react-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{projectFormState.projectId ? 'Edit project' : 'Create project'}</h3>
            <form onSubmit={submitProjectForm} className="canvas-react-form">
              <label>Name<input value={projectFormState.values.name} onChange={(event) => setProjectFormState((prev) => ({ ...prev, values: { ...prev.values, name: event.target.value } }))} required /></label>
              <label>Description<textarea rows={3} value={projectFormState.values.description} onChange={(event) => setProjectFormState((prev) => ({ ...prev, values: { ...prev.values, description: event.target.value } }))} /></label>
              <label>Start Date<input type="date" value={projectFormState.values.start_date} onChange={(event) => setProjectFormState((prev) => ({ ...prev, values: { ...prev.values, start_date: event.target.value } }))} /></label>
              <label>End Date<input type="date" value={projectFormState.values.end_date} onChange={(event) => setProjectFormState((prev) => ({ ...prev, values: { ...prev.values, end_date: event.target.value } }))} /></label>
              <div className="canvas-react-form-actions">
                <button type="button" className="ghost-button" onClick={() => setProjectFormState({ open: false, projectId: null, values: defaultProjectForm })}>Cancel</button>
                <button type="submit">{projectFormState.projectId ? 'Save Changes' : 'Create Project'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {employeeFormState.open ? (
        <div className="canvas-react-modal-backdrop" onClick={() => setEmployeeFormState({ open: false, employeeId: null, values: defaultEmployeeForm })}>
          <div className="canvas-react-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Edit employee</h3>
            <form onSubmit={submitEmployeeForm} className="canvas-react-form">
              <label>Name<input value={employeeFormState.values.name} onChange={(event) => setEmployeeFormState((prev) => ({ ...prev, values: { ...prev.values, name: event.target.value } }))} required /></label>
              <label>Role<input value={employeeFormState.values.role} onChange={(event) => setEmployeeFormState((prev) => ({ ...prev, values: { ...prev.values, role: event.target.value } }))} /></label>
              <label>Type<select value={employeeFormState.values.employee_type} onChange={(event) => setEmployeeFormState((prev) => ({ ...prev, values: { ...prev.values, employee_type: event.target.value } }))}><option value="IC">IC</option><option value="L">L</option></select></label>
              <label>Manager<select value={employeeFormState.values.manager_id} onChange={(event) => setEmployeeFormState((prev) => ({ ...prev, values: { ...prev.values, manager_id: event.target.value } }))}><option value="">No manager</option>{data.employees.filter((employee) => employee.id !== employeeFormState.employeeId).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
              <label>Location<input value={employeeFormState.values.location} onChange={(event) => setEmployeeFormState((prev) => ({ ...prev, values: { ...prev.values, location: event.target.value } }))} /></label>
              <label>Capacity<input type="number" min="0.1" step="0.1" value={employeeFormState.values.capacity} onChange={(event) => setEmployeeFormState((prev) => ({ ...prev, values: { ...prev.values, capacity: event.target.value } }))} /></label>
              <div className="canvas-react-form-actions">
                <button type="button" className="ghost-button" onClick={() => setEmployeeFormState({ open: false, employeeId: null, values: defaultEmployeeForm })}>Cancel</button>
                <button type="submit">Save Employee</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {assignmentFormState.open ? (
        <div className="canvas-react-modal-backdrop" onClick={() => setAssignmentFormState({ open: false, values: defaultAssignmentForm })}>
          <div className="canvas-react-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create assignment</h3>
            <form onSubmit={submitAssignmentForm} className="canvas-react-form">
              <label>Employee<select value={assignmentFormState.values.employee_id} onChange={(event) => setAssignmentFormState((prev) => ({ ...prev, values: { ...prev.values, employee_id: event.target.value } }))}>{data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
              <label>Project<select value={assignmentFormState.values.project_id} onChange={(event) => setAssignmentFormState((prev) => ({ ...prev, values: { ...prev.values, project_id: event.target.value } }))}>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              <label>Start Date<input type="date" value={assignmentFormState.values.start_date} onChange={(event) => setAssignmentFormState((prev) => ({ ...prev, values: { ...prev.values, start_date: event.target.value } }))} required /></label>
              <label>End Date<input type="date" value={assignmentFormState.values.end_date} onChange={(event) => setAssignmentFormState((prev) => ({ ...prev, values: { ...prev.values, end_date: event.target.value } }))} required /></label>
              <label>Allocation (%)<input type="number" min="1" max="100" value={assignmentFormState.values.allocation} onChange={(event) => setAssignmentFormState((prev) => ({ ...prev, values: { ...prev.values, allocation: event.target.value } }))} required /></label>
              <label>Notes<textarea rows={3} value={assignmentFormState.values.notes} onChange={(event) => setAssignmentFormState((prev) => ({ ...prev, values: { ...prev.values, notes: event.target.value } }))} /></label>
              <div className="canvas-react-form-actions">
                <button type="button" className="ghost-button" onClick={() => setAssignmentFormState({ open: false, values: defaultAssignmentForm })}>Cancel</button>
                <button type="submit">Create Assignment</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {removeAssignmentState.open ? (
        <div className="canvas-react-modal-backdrop" onClick={() => setRemoveAssignmentState({ open: false, assignmentId: '' })}>
          <div className="canvas-react-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Remove assignment</h3>
            <div className="canvas-react-form">
              <label>Assignment<select value={removeAssignmentState.assignmentId} onChange={(event) => setRemoveAssignmentState({ open: true, assignmentId: event.target.value })}><option value="">Select assignment…</option>{assignmentChoices.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.label}</option>)}</select></label>
              <div className="canvas-react-form-actions">
                <button type="button" className="ghost-button" onClick={() => setRemoveAssignmentState({ open: false, assignmentId: '' })}>Cancel</button>
                <button type="button" className="danger-button" disabled={!removeAssignmentState.assignmentId} onClick={() => deleteSelectedAssignment(Number(removeAssignmentState.assignmentId))}>Remove Assignment</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {projectTimeline ? (
        <div className="canvas-react-modal-backdrop" onClick={() => setProjectTimeline(null)}>
          <div className="canvas-react-modal canvas-react-modal-wide" onClick={(event) => event.stopPropagation()}>
            <h3>{projectTimeline.project.name} details</h3>
            <div className="canvas-react-timeline-list">
              {projectTimeline.assignments.length ? projectTimeline.assignments.map((assignment) => {
                const employee = data.employees.find((emp) => emp.id === assignment.employee_id);
                return <div key={assignment.id} className="canvas-react-timeline-item"><strong>{employee?.name || 'Employee'}</strong><span>{formatDate(assignment.start_date)} → {formatDate(assignment.end_date)}</span><span>{formatPct(assignment.allocation)}</span></div>;
              }) : <p className="muted">No assignments yet.</p>}
            </div>
            <div className="canvas-react-form-actions">
              <button type="button" className="ghost-button" onClick={() => setProjectTimeline(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

async function api(page, path, options = {}) {
  return page.request.fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

async function createOrganization(page, { name, description = null }) {
  const response = await api(page, '/organizations', {
    method: 'POST',
    data: { name, description },
  });
  if (!response.ok()) throw new Error(`createOrganization failed: ${response.status()}`);
  return response.json();
}

async function createEmployee(page, payload) {
  const response = await api(page, '/employees', {
    method: 'POST',
    data: payload,
  });
  if (!response.ok()) throw new Error(`createEmployee failed: ${response.status()} ${await response.text()}`);
  return response.json();
}

async function createProject(page, payload) {
  const response = await api(page, '/projects', {
    method: 'POST',
    data: payload,
  });
  if (!response.ok()) throw new Error(`createProject failed: ${response.status()}`);
  return response.json();
}

async function createAssignment(page, payload) {
  const response = await api(page, '/assignments', {
    method: 'POST',
    data: payload,
  });
  if (!response.ok()) throw new Error(`createAssignment failed: ${response.status()}`);
  return response.json();
}

module.exports = {
  api,
  createOrganization,
  createEmployee,
  createProject,
  createAssignment,
};

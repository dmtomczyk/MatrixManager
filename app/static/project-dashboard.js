const chartCanvas = document.getElementById('dashboard-chart');
const monthlyChartCanvas = document.getElementById('dashboard-monthly-chart');
const projectPickerBtn = document.getElementById('project-picker-btn');
const projectPickerPanel = document.getElementById('project-picker-panel');
const projectSearch = document.getElementById('project-search');
const projectCheckboxes = document.getElementById('project-checkboxes');
const projectSelectAll = document.getElementById('project-select-all');
const projectClearBtn = document.getElementById('project-clear');
const startInput = document.getElementById('dashboard-start');
const endInput = document.getElementById('dashboard-end');
const applyBtn = document.getElementById('apply-range');
const resetBtn = document.getElementById('reset-range');
const toast = document.getElementById('toast');

const DAY_MS = 86400000;
const WEEK_MS = DAY_MS * 7;

let projects = [];
let demands = [];
let assignments = [];
let selectedProjectIds = new Set();
let chart;
let monthlyChart;
let defaultRange = { start: null, end: null };

const apiFetch = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Request failed');
  return res.json();
};

const showToast = (message) => {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
};

const toDateValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return NaN;
  date.setHours(0, 0, 0, 0);
  return date.valueOf();
};

const overlapsRange = (startValue, endValue, rangeStart, rangeEnd) => startValue <= rangeEnd && endValue >= rangeStart;
const formatISODate = (date) => date.toISOString().split('T')[0];
const formatMonthLabel = (value) => new Date(value).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

const buildColor = (index) => {
  const palette = ['#2563eb', '#16a34a', '#f97316', '#a855f7', '#0ea5e9', '#f43f5e', '#14b8a6'];
  return palette[index % palette.length];
};

const lightenHex = (hex, factor = 0.45) => {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const mix = (channel) => Math.round(channel + (255 - channel) * factor);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};

const computeDefaultRange = () => {
  const projectStartValues = projects.map((proj) => toDateValue(proj.start_date)).filter(Number.isFinite);
  const projectEndValues = projects.map((proj) => toDateValue(proj.end_date)).filter(Number.isFinite);
  const demandStartValues = demands.map((item) => toDateValue(item.start_date)).filter(Number.isFinite);
  const demandEndValues = demands.map((item) => toDateValue(item.end_date)).filter(Number.isFinite);
  const assignmentStartValues = assignments.map((item) => toDateValue(item.start_date)).filter(Number.isFinite);
  const assignmentEndValues = assignments.map((item) => toDateValue(item.end_date)).filter(Number.isFinite);
  const starts = [...projectStartValues, ...demandStartValues, ...assignmentStartValues];
  const ends = [...projectEndValues, ...demandEndValues, ...assignmentEndValues];
  defaultRange.start = starts.length ? Math.min(...starts) : Date.now();
  defaultRange.end = ends.length ? Math.max(...ends) : Date.now();
};

const getRange = () => {
  const startValue = toDateValue(startInput.value) || defaultRange.start;
  const endValue = toDateValue(endInput.value) || defaultRange.end;
  return { start: Math.min(startValue, endValue), end: Math.max(startValue, endValue) };
};

const updatePickerSummary = () => {
  if (!projectPickerBtn) return;
  if (selectedProjectIds.size === projects.length) projectPickerBtn.textContent = 'All projects';
  else if (!selectedProjectIds.size) projectPickerBtn.textContent = 'No projects selected';
  else projectPickerBtn.textContent = `${selectedProjectIds.size} of ${projects.length} projects`;
};

const renderProjectCheckboxes = (query = '') => {
  if (!projectCheckboxes) return;
  const filterText = query.toLowerCase();
  projectCheckboxes.innerHTML = '';
  projects
    .filter((project) => project.name.toLowerCase().includes(filterText))
    .forEach((project) => {
      const id = project.id;
      const wrapper = document.createElement('label');
      wrapper.className = 'filter-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = id;
      checkbox.checked = selectedProjectIds.has(id);
      checkbox.addEventListener('change', (event) => {
        if (event.target.checked) selectedProjectIds.add(id);
        else selectedProjectIds.delete(id);
        updatePickerSummary();
        renderCharts();
      });
      const name = document.createElement('span');
      name.textContent = project.name;
      wrapper.append(checkbox, name);
      projectCheckboxes.appendChild(wrapper);
    });
};

const renderFilters = () => {
  renderProjectCheckboxes(projectSearch?.value || '');
  updatePickerSummary();
  if (!startInput.value && defaultRange.start) startInput.value = formatISODate(new Date(defaultRange.start));
  if (!endInput.value && defaultRange.end) endInput.value = formatISODate(new Date(defaultRange.end));
};

const buildWeeklyBuckets = (rangeStart, rangeEnd) => {
  const weeks = [];
  let cursor = rangeStart;
  const MAX_WEEKS = 520;
  while (cursor <= rangeEnd && weeks.length < MAX_WEEKS) {
    const weekStart = cursor;
    const weekEnd = Math.min(cursor + WEEK_MS - DAY_MS, rangeEnd);
    weeks.push({ start: weekStart, end: weekEnd });
    cursor += WEEK_MS;
  }
  return weeks;
};

const buildMonthlyBuckets = (rangeStart, rangeEnd) => {
  const buckets = [];
  const startDate = new Date(rangeStart);
  const endDate = new Date(rangeEnd);
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const finalMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= finalMonth && buckets.length < 120) {
    const bucketStart = cursor.getTime();
    const bucketEndDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    bucketEndDate.setHours(0, 0, 0, 0);
    buckets.push({ start: bucketStart, end: Math.min(bucketEndDate.getTime(), rangeEnd), label: formatMonthLabel(bucketStart) });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return buckets;
};

const projectDemandItems = (projectId) => demands.filter((item) => item.project_id === projectId);
const projectAssignmentItems = (projectId) => assignments.filter((item) => item.project_id === projectId);

const buildBreakdownLabel = (items, labelKey, valueKey = 'allocation') => {
  if (!items.length) return ['No contributing records'];
  return items.map((item) => `${item[labelKey] || 'Untitled'}: ${(item[valueKey] || 0).toFixed(2)} FTE`);
};

const computeBucketValue = (items, bucket, labelKey, valueKey) => {
  const contributors = items.filter((item) => {
    const startValue = toDateValue(item.start_date);
    const endValue = toDateValue(item.end_date);
    if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) return false;
    return overlapsRange(startValue, endValue, bucket.start, bucket.end);
  });
  const total = contributors.reduce((sum, item) => sum + (item[valueKey] || 0), 0);
  return {
    total: Number(total.toFixed(2)),
    lines: buildBreakdownLabel(contributors, labelKey, valueKey),
  };
};

const computeWeeklyDatasets = (rangeStart, rangeEnd) => {
  const buckets = buildWeeklyBuckets(rangeStart, rangeEnd);
  const labels = buckets.map((bucket) => new Date(bucket.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const datasets = [];
  projects.filter((project) => selectedProjectIds.has(project.id)).forEach((project, index) => {
    const baseColor = buildColor(index);
    const demandItems = projectDemandItems(project.id);
    const allocationItems = projectAssignmentItems(project.id);
    const demandBreakdowns = buckets.map((bucket) => computeBucketValue(demandItems, bucket, 'title', 'required_allocation'));
    const allocationBreakdowns = buckets.map((bucket) => computeBucketValue(allocationItems, bucket, 'employee_name', 'allocation'));
    datasets.push({
      label: `${project.name} — Demand`,
      projectName: project.name,
      forecastKind: 'demand',
      data: demandBreakdowns.map((item) => item.total),
      tooltipBreakdown: demandBreakdowns.map((item) => item.lines),
      borderColor: baseColor,
      backgroundColor: baseColor,
      borderWidth: 2.5,
      tension: 0.25,
      pointRadius: 0,
      fill: false,
    });
    datasets.push({
      label: `${project.name} — Allocation`,
      projectName: project.name,
      forecastKind: 'allocation',
      data: allocationBreakdowns.map((item) => item.total),
      tooltipBreakdown: allocationBreakdowns.map((item) => item.lines),
      borderColor: lightenHex(baseColor, 0.45),
      backgroundColor: lightenHex(baseColor, 0.45),
      borderDash: [8, 4],
      borderWidth: 2,
      tension: 0.25,
      pointRadius: 0,
      fill: false,
    });
  });
  return { labels, datasets };
};

const computeMonthlyDatasets = (rangeStart, rangeEnd) => {
  const buckets = buildMonthlyBuckets(rangeStart, rangeEnd);
  const labels = buckets.map((bucket) => bucket.label);
  const datasets = [];
  projects.filter((project) => selectedProjectIds.has(project.id)).forEach((project, index) => {
    const baseColor = buildColor(index);
    const demandItems = projectDemandItems(project.id);
    const allocationItems = projectAssignmentItems(project.id);
    const demandBreakdowns = buckets.map((bucket) => computeBucketValue(demandItems, bucket, 'title', 'required_allocation'));
    const allocationBreakdowns = buckets.map((bucket) => computeBucketValue(allocationItems, bucket, 'employee_name', 'allocation'));
    datasets.push({
      label: `${project.name} — Demand`,
      projectName: project.name,
      forecastKind: 'demand',
      data: demandBreakdowns.map((item) => item.total),
      tooltipBreakdown: demandBreakdowns.map((item) => item.lines),
      backgroundColor: baseColor,
      borderColor: baseColor,
      borderWidth: 1,
    });
    datasets.push({
      label: `${project.name} — Allocation`,
      projectName: project.name,
      forecastKind: 'allocation',
      data: allocationBreakdowns.map((item) => item.total),
      tooltipBreakdown: allocationBreakdowns.map((item) => item.lines),
      backgroundColor: lightenHex(baseColor, 0.45),
      borderColor: lightenHex(baseColor, 0.45),
      borderWidth: 1,
    });
  });
  return { labels, datasets };
};

const tooltipLabel = (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw || 0).toFixed(2)} FTE`;
const tooltipAfterBody = (items) => {
  const point = items[0];
  if (!point) return [];
  return point.dataset.tooltipBreakdown?.[point.dataIndex] || [];
};

const renderCharts = () => {
  const { start, end } = getRange();
  const weekly = computeWeeklyDatasets(start, end);
  const monthly = computeMonthlyDatasets(start, end);
  if (chart) chart.destroy();
  if (monthlyChart) monthlyChart.destroy();
  chart = new Chart(chartCanvas, {
    type: 'line',
    data: weekly,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'FTE' } } },
      plugins: { tooltip: { callbacks: { label: tooltipLabel, afterBody: tooltipAfterBody } } },
    },
  });
  monthlyChart = new Chart(monthlyChartCanvas, {
    type: 'bar',
    data: monthly,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'FTE' } } },
      plugins: { tooltip: { callbacks: { label: tooltipLabel, afterBody: tooltipAfterBody } } },
    },
  });
};

const loadData = async () => {
  try {
    const [projectData, demandData, assignmentData] = await Promise.all([apiFetch('/projects'), apiFetch('/demands-api'), apiFetch('/assignments')]);
    projects = projectData;
    demands = demandData;
    assignments = assignmentData;
    selectedProjectIds = new Set(projects.map((proj) => proj.id));
    computeDefaultRange();
    renderFilters();
    renderCharts();
  } catch (err) {
    showToast(err.message);
  }
};

applyBtn.addEventListener('click', () => renderCharts());
resetBtn.addEventListener('click', () => {
  startInput.value = defaultRange.start ? formatISODate(new Date(defaultRange.start)) : '';
  endInput.value = defaultRange.end ? formatISODate(new Date(defaultRange.end)) : '';
  renderCharts();
});
projectPickerBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  projectPickerPanel?.classList.toggle('hidden');
});
document.addEventListener('click', (event) => {
  if (!projectPickerPanel || projectPickerPanel.classList.contains('hidden')) return;
  if (event.target === projectPickerPanel || projectPickerPanel.contains(event.target) || event.target === projectPickerBtn) return;
  projectPickerPanel.classList.add('hidden');
});
projectSearch?.addEventListener('input', (event) => renderProjectCheckboxes(event.target.value));
projectSelectAll?.addEventListener('click', () => {
  selectedProjectIds = new Set(projects.map((proj) => proj.id));
  renderProjectCheckboxes(projectSearch?.value || '');
  updatePickerSummary();
  renderCharts();
});
projectClearBtn?.addEventListener('click', () => {
  selectedProjectIds.clear();
  renderProjectCheckboxes(projectSearch?.value || '');
  updatePickerSummary();
  renderCharts();
});

loadData();

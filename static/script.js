// static/script.js
let chartInstance = null;
const variablesContainer = document.getElementById('variables-list');
const varCountLabel = document.getElementById('var-count-lbl');
const addVarButton = document.getElementById('add-var-btn');

// Multi-variable result view controls
const viewControls = document.getElementById('view-controls');
const viewModeSelect = document.getElementById('view-mode');
const matrixRowSelect = document.getElementById('matrix-row-var');
const matrixColSelect = document.getElementById('matrix-col-var');
const matrixMetricSelect = document.getElementById('matrix-metric');
const matrixSliceContainer = document.getElementById('matrix-slice-controls');

// Last sweep payload, kept so the view can be re-rendered without re-simulating
let lastMultiData = null;
// Fixed values for variables that are not on either matrix axis, keyed by name
let sliceSelections = {};

// Maximum parallel variables to avoid browser lockup
const MAX_VARIABLES = 3;

// Initial Mockup values to populate on launch
const initialVars = [];

// 1. Parser to turn range strings into arrays
function parseVariableRange(expr) {
    expr = expr.trim().replace(/\s+/g, '');
    if (!expr) return [];

    // Case A: Comma-separated list e.g., "1,2,5,10"
    if (expr.includes(',')) {
        return expr.split(',').map(Number).filter(n => !isNaN(n));
    }

    // Case B: Ranges like "1-5" or "1-10:2" (start-stop:step)
    const rangeRegex = /^(\d+)-(\d+)(?::(\d+))?$/;
    const match = expr.match(rangeRegex);
    if (match) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        const step = match[3] ? parseInt(match[3], 10) : 1;
        
        const result = [];
        for (let i = start; i <= end; i += step) {
            result.push(i);
        }
        return result;
    }

    // Case C: Single numeric value "15"
    const single = Number(expr);
    if (!isNaN(single) && expr !== '') {
        return [single];
    }

    return [];
}

// 2. Add / Render Variable inputs
function createVariableCard(name = '', expr = '') {
    const currentCount = variablesContainer.children.length;
    if (currentCount >= MAX_VARIABLES) return;

    const cardId = `var-card-${Date.now()}`;
    const card = document.createElement('div');
    card.className = 'variable-card';
    card.id = cardId;

    card.innerHTML = `
        <div class="variable-card-header" onclick="toggleCardBody('${cardId}')">
            <span><strong class="header-name">${name || 'New variable'}</strong></span>
        </div>
        <div class="variable-card-body" id="${cardId}-body">
            <div class="variable-inputs-row">
                <div>
                    <label>Variable name</label>
                    <input type="text" class="var-name-input" value="${name}" placeholder="e.g., n" required>
                </div>
                <div>
                    <label>Values (e.g., 1,2,3 or 1-5 or 1-6:2)</label>
                    <input type="text" class="var-expr-input" value="${expr}" placeholder="e.g., 1-5" required>
                </div>
            </div>
            <div>
                <button type="button" class="secondary-btn delete-var-btn" onclick="deleteVariable('${cardId}')">Delete</button>
            </div>
            <div class="parsed-info">Parsed values: <span class="parsed-output">[]</span></div>
        </div>
    `;

    variablesContainer.appendChild(card);
    updateVariableCount();

    // Bind reactive keyup parsing events
    const nameInput = card.querySelector('.var-name-input');
    const exprInput = card.querySelector('.var-expr-input');
    const headerName = card.querySelector('.header-name');
    const parsedOutput = card.querySelector('.parsed-output');

    const updateParsedValue = () => {
        headerName.innerText = nameInput.value || 'New variable';
        const parsed = parseVariableRange(exprInput.value);
        parsedOutput.innerText = JSON.stringify(parsed);
    };

    nameInput.addEventListener('input', updateParsedValue);
    exprInput.addEventListener('input', updateParsedValue);
    
    // Initial evaluation
    updateParsedValue();
}

function deleteVariable(cardId) {
    const card = document.getElementById(cardId);
    if (card) {
        card.remove();
        updateVariableCount();
    }
}

function toggleCardBody(cardId) {
    const body = document.getElementById(`${cardId}-body`);
    const header = document.querySelector(`#${cardId} .variable-card-header span`);
    if (body.style.display === 'none') {
        body.style.display = 'flex';
        header.innerHTML = `<strong class="header-name">${header.querySelector('strong').innerText}</strong>`;
    } else {
        body.style.display = 'none';
        header.innerHTML = `<strong class="header-name">${header.querySelector('strong').innerText}</strong>`;
    }
}

function updateVariableCount() {
    const currentCount = variablesContainer.children.length;
    varCountLabel.innerText = `Current number of variables: ${currentCount}/${MAX_VARIABLES}`;
    addVarButton.disabled = currentCount >= MAX_VARIABLES;
}

// Instantiate starting cards automatically
initialVars.forEach(v => createVariableCard(v.name, v.expr));

addVarButton.addEventListener('click', () => createVariableCard());

// 3. Document keyboard submit hotkey
document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        document.getElementById('calc-form').requestSubmit();
    }
});

// 4. Form Submit & API Query Handler
document.getElementById('calc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const expressionInput = document.getElementById('expression').value;
    const dashboard = document.getElementById('dashboard');
    const dashboardGrid = document.getElementById('dashboard-grid');
    const chartSection = document.getElementById('chart-section-wrapper');
    const errorBox = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-btn');

    submitBtn.innerText = "Simulating...";
    submitBtn.disabled = true;
    errorBox.style.display = 'none';

    // Pack active variables payload
    const payloadVariables = [];
    const varCards = variablesContainer.querySelectorAll('.variable-card');
    varCards.forEach(card => {
        const name = card.querySelector('.var-name-input').value.trim();
        const expr = card.querySelector('.var-expr-input').value;
        if (name) {
            payloadVariables.push({
                name: name,
                values: parseVariableRange(expr)
            });
        }
    });

    try {
        const response = await fetch('/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                expression: expressionInput,
                variables: payloadVariables
            })
        });
        
        const data = await response.json();

        if (data.success) {
            const table = document.getElementById('summary-table');
            dashboard.style.display = 'block';

            if (data.mode === 'single') {
                // SINGLE MODE: Show Chart, Render 1x3 metric table
                chartSection.style.display = 'block';
                dashboardGrid.className = "dashboard-grid single-mode";
                viewControls.style.display = 'none';
                lastMultiData = null;

                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Mean</td>
                            <td style="font-weight: 600;">${data.mean.toFixed(3)}</td>
                        </tr>
                        <tr>
                            <td>Median</td>
                            <td style="font-weight: 600;">${data.median}</td>
                        </tr>
                        <tr>
                            <td>Standard deviation (bias corrected)</td>
                            <td style="font-weight: 600;">${data.std.toFixed(3)}</td>
                        </tr>
                    </tbody>
                `;
                renderChart(data.chart_data);

            } else {
                // VARIABLE SWEEP MODE: Hide Chart, render sweep table (list or matrix)
                chartSection.style.display = 'none';
                dashboardGrid.className = "dashboard-grid"; // 1 Full column width grid
                viewControls.style.display = 'flex';

                lastMultiData = data;
                setupMultiControls(data);
                renderMultiResults();
            }

        } else {
            dashboard.style.display = 'none';
            errorBox.innerText = `❌ ${data.error}`;
            errorBox.style.display = 'block';
        }
    } catch (err) {
        dashboard.style.display = 'none';
        errorBox.innerText = `❌ Server connection failed. Check your console logs.`;
        errorBox.style.display = 'block';
        console.error(err);
    } finally {
        submitBtn.innerHTML = 'Simulate <span class="key-badge">S</span>';
        submitBtn.disabled = false;
    }
});

// 5. Multi-variable result views (flat list vs. two-variable matrix)
// Tracks whether the user picked a view themselves; until then the matrix is the default
let userChoseView = false;

const HEAT_METRICS = ['mean', 'median', 'std'];

function formatMetric(metric, value) {
    if (typeof value !== 'number' || !isFinite(value)) return '—';
    // Medians of integer distributions are integers; keep them free of noise decimals
    return metric === 'median' && Number.isInteger(value) ? String(value) : value.toFixed(3);
}

// Plasma fill scaled between min and max, with text kept readable on both ends
function heatStyle(value, min, max) {
    if (typeof value !== 'number' || !isFinite(value)) return '';
    const t = max > min ? (value - min) / (max - min) : 0.5;
    const c = getPlasmaRGB(t);
    const luminance = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    return `background-color: rgb(${c.r}, ${c.g}, ${c.b}); color: ${luminance > 0.55 ? '#1e293b' : '#f8fafc'};`;
}

// Value range per metric, so each list column is shaded on its own scale
function metricRanges(rows) {
    const ranges = {};
    HEAT_METRICS.forEach(metric => {
        const values = rows.map(r => r[metric]).filter(v => typeof v === 'number' && isFinite(v));
        ranges[metric] = { min: Math.min(...values), max: Math.max(...values) };
    });
    return ranges;
}

function uniqueValues(data, varName) {
    return [...new Set(data.results.map(r => r.combination[varName]))].sort((a, b) => a - b);
}

function fillVarOptions(select, names, preferred) {
    select.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
    if (names.includes(preferred)) select.value = preferred;
}

// Populate the axis dropdowns, keeping the user's previous picks when still valid
function setupMultiControls(data) {
    const names = data.variables_ordered;

    // A matrix needs two axes; fall back to the list view with a single variable
    const matrixOption = viewModeSelect.querySelector('option[value="matrix"]');
    matrixOption.disabled = names.length < 2;
    if (names.length < 2) {
        viewModeSelect.value = 'list';
    } else if (!userChoseView) {
        // Matrix is the default whenever there are enough variables for one
        viewModeSelect.value = 'matrix';
    }

    fillVarOptions(matrixRowSelect, names, matrixRowSelect.value);
    const previousCol = matrixColSelect.value;
    const colPreferred = (names.includes(previousCol) && previousCol !== matrixRowSelect.value)
        ? previousCol
        : names.find(n => n !== matrixRowSelect.value);
    fillVarOptions(matrixColSelect, names, colPreferred);
}

// Dropdowns fixing the value of every variable that isn't on an axis
function renderSliceControls(data, rowVar, colVar) {
    const others = data.variables_ordered.filter(n => n !== rowVar && n !== colVar);
    matrixSliceContainer.innerHTML = '';

    others.forEach((name, idx) => {
        const values = uniqueValues(data, name);
        if (!values.some(v => String(v) === String(sliceSelections[name]))) {
            sliceSelections[name] = values[0];
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'control-item';
        wrapper.innerHTML = `
            <label for="slice-select-${idx}">${name} =</label>
            <select id="slice-select-${idx}">
                ${values.map(v => `<option value="${v}"${String(v) === String(sliceSelections[name]) ? ' selected' : ''}>${v}</option>`).join('')}
            </select>
        `;
        wrapper.querySelector('select').addEventListener('change', (e) => {
            sliceSelections[name] = e.target.value;
            renderMultiResults();
        });
        matrixSliceContainer.appendChild(wrapper);
    });
}

function buildListTable(data) {
    let headerHTML = '<tr>';
    data.variables_ordered.forEach(vName => {
        headerHTML += `<th>Var (${vName})</th>`;
    });
    headerHTML += '<th>Mean</th><th>Median</th><th>Std Dev</th></tr>';

    // Each metric column is shaded independently over its own value range
    const ranges = metricRanges(data.results);

    let bodyHTML = '';
    data.results.forEach(row => {
        bodyHTML += '<tr>';
        data.variables_ordered.forEach(vName => {
            bodyHTML += `<td style="font-family: monospace;">${row.combination[vName]}</td>`;
        });
        HEAT_METRICS.forEach(metric => {
            const style = heatStyle(row[metric], ranges[metric].min, ranges[metric].max);
            bodyHTML += `<td class="heat-cell" style="${style}">${formatMetric(metric, row[metric])}</td>`;
        });
        bodyHTML += '</tr>';
    });

    return `<thead>${headerHTML}</thead><tbody>${bodyHTML}</tbody>`;
}

function buildMatrixTable(data, rowVar, colVar, metric) {
    const rowValues = uniqueValues(data, rowVar);
    const colValues = uniqueValues(data, colVar);
    const fixedVars = data.variables_ordered.filter(n => n !== rowVar && n !== colVar);

    // Index the sweep results by (row value, column value) for the current slice
    const cells = new Map();
    data.results.forEach(r => {
        const combo = r.combination;
        if (!fixedVars.every(n => String(combo[n]) === String(sliceSelections[n]))) return;
        cells.set(`${combo[rowVar]}|${combo[colVar]}`, r[metric]);
    });

    const numeric = [...cells.values()].filter(v => typeof v === 'number' && isFinite(v));
    const min = Math.min(...numeric);
    const max = Math.max(...numeric);

    let headerHTML = `<tr><th class="matrix-corner">${rowVar} \\ ${colVar}</th>`;
    colValues.forEach(cv => { headerHTML += `<th class="matrix-axis">${cv}</th>`; });
    headerHTML += '</tr>';

    let bodyHTML = '';
    rowValues.forEach(rv => {
        bodyHTML += `<tr><th scope="row" class="matrix-axis">${rv}</th>`;
        colValues.forEach(cv => {
            const value = cells.get(`${rv}|${cv}`);
            bodyHTML += `<td class="matrix-cell heat-cell" style="${heatStyle(value, min, max)}">${formatMetric(metric, value)}</td>`;
        });
        bodyHTML += '</tr>';
    });

    return `<thead>${headerHTML}</thead><tbody>${bodyHTML}</tbody>`;
}

function renderMultiResults() {
    if (!lastMultiData) return;

    const data = lastMultiData;
    const table = document.getElementById('summary-table');
    const isMatrix = viewModeSelect.value === 'matrix' && data.variables_ordered.length >= 2;

    viewControls.querySelectorAll('.matrix-only').forEach(el => {
        el.style.display = isMatrix ? 'flex' : 'none';
    });

    if (!isMatrix) {
        table.className = '';
        table.innerHTML = buildListTable(data);
        return;
    }

    const rowVar = matrixRowSelect.value;
    // Both axes must differ; nudge the column axis off the row variable if needed
    if (matrixColSelect.value === rowVar) {
        matrixColSelect.value = data.variables_ordered.find(n => n !== rowVar);
    }
    const colVar = matrixColSelect.value;

    renderSliceControls(data, rowVar, colVar);
    table.className = 'matrix-table';
    table.innerHTML = buildMatrixTable(data, rowVar, colVar, matrixMetricSelect.value);
}

[viewModeSelect, matrixRowSelect, matrixColSelect, matrixMetricSelect].forEach(select => {
    select.addEventListener('change', renderMultiResults);
});

viewModeSelect.addEventListener('change', () => { userChoseView = true; });

// 6. Plasma Colored Chart Renderer
function getPlasmaColor(t) {
  const c = getPlasmaRGB(t);
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

function getPlasmaRGB(t) {
  t = Math.max(0, Math.min(1, t));
  const plasmaPoints = [
    { r: 13,   g: 8,   b: 135 },
    { r: 75,   g: 3,   b: 161 },
    { r: 125,  g: 3,   b: 168 },
    { r: 168,  g: 34,  b: 150 },
    { r: 203,  g: 70,  b: 121 },
    { r: 229,  g: 107, b: 93  },
    { r: 240,  g: 249, b: 33  }
  ];

  if (t === 0) return plasmaPoints[0];
  if (t === 1) return plasmaPoints[plasmaPoints.length - 1];

  const segmentCount = plasmaPoints.length - 1;
  const scaledT = t * segmentCount;
  const index = Math.floor(scaledT);
  const localT = scaledT - index;

  const c1 = plasmaPoints[index];
  const c2 = plasmaPoints[index + 1];

  return {
    r: Math.round(c1.r + (c2.r - c1.r) * localT),
    g: Math.round(c1.g + (c2.g - c1.g) * localT),
    b: Math.round(c1.b + (c2.b - c1.b) * localT)
  };
}

function renderChart(chartData) {
    const ctx = document.getElementById('distributionChart').getContext('2d');
    if (chartInstance) {
        chartInstance.destroy();
    }

    const backgroundColors = chartData.cumulative.map(getPlasmaColor);

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Probability',
                    data: chartData.probabilities,
                    backgroundColor: backgroundColors,
                    borderWidth: 0,
                    yAxisID: 'y_probability',
                    order: 2
                },
                {
                    label: 'Cumulative',
                    data: chartData.cumulative,
                    borderColor: 'rgba(173, 216, 230, 0.85)',
                    backgroundColor: 'rgba(173, 216, 230, 0.2)',
                    fill: false,
                    type: 'line',
                    tension: 0.3,
                    pointRadius: 3,
                    yAxisID: 'y_cumulative',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Roll Value', font: { weight: 'bold' } },
                    grid: { display: false }
                },
                y_probability: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'Probability', font: { weight: 'bold' } },
                    min: 0,
                    grid: { color: '#f1f5f9' }
                },
                y_cumulative: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'Cumulative Probability', font: { weight: 'bold' } },
                    min: 0,
                    max: 1,
                    grid: { display: false }
                }
            }
        }
    });
}
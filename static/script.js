// static/script.js
let chartInstance = null;
const variablesContainer = document.getElementById('variables-list');
const varCountLabel = document.getElementById('var-count-lbl');
const addVarButton = document.getElementById('add-var-btn');

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
                // VARIABLE SWEEP MODE: Hide Chart, render wide sweep table
                chartSection.style.display = 'none';
                dashboardGrid.className = "dashboard-grid"; // 1 Full column width grid

                // Build Table headers for each variable dynamically
                let headerHTML = '<tr>';
                data.variables_ordered.forEach(vName => {
                    headerHTML += `<th>Var (${vName})</th>`;
                });
                headerHTML += '<th>Mean</th><th>Median</th><th>Std Dev</th></tr>';

                // Build rows
                let bodyHTML = '';
                data.results.forEach(row => {
                    bodyHTML += '<tr>';
                    // Render variables values
                    data.variables_ordered.forEach(vName => {
                        bodyHTML += `<td style="font-family: monospace;">${row.combination[vName]}</td>`;
                    });
                    // Render outputs
                    bodyHTML += `
                        <td style="font-weight: 600;">${row.mean.toFixed(3)}</td>
                        <td style="font-weight: 600;">${row.median}</td>
                        <td>${row.std.toFixed(3)}</td>
                    </tr>`;
                });

                table.innerHTML = `<thead>${headerHTML}</thead><tbody>${bodyHTML}</tbody>`;
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

// 5. Plasma Colored Chart Renderer
function getPlasmaColor(t) {
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

  if (t === 0) return `rgb(${plasmaPoints[0].r}, ${plasmaPoints[0].g}, ${plasmaPoints[0].b})`;
  if (t === 1) {
    const last = plasmaPoints[plasmaPoints.length - 1];
    return `rgb(${last.r}, ${last.g}, ${last.b})`;
  }

  const segmentCount = plasmaPoints.length - 1;
  const scaledT = t * segmentCount;
  const index = Math.floor(scaledT);
  const localT = scaledT - index;

  const c1 = plasmaPoints[index];
  const c2 = plasmaPoints[index + 1];

  const r = Math.round(c1.r + (c2.r - c1.r) * localT);
  const g = Math.round(c1.g + (c2.g - c1.g) * localT);
  const b = Math.round(c1.b + (c2.b - c1.b) * localT);

  return `rgb(${r}, ${g}, ${b})`;
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
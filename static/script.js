// static/script.js
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
let variableCardSeq = 0;

function createVariableCard(name = '', expr = '') {
    const currentCount = variablesContainer.children.length;
    if (currentCount >= MAX_VARIABLES) return;

    // A counter, not a timestamp: restoring a history entry creates several cards at once
    const cardId = `var-card-${++variableCardSeq}`;
    const card = document.createElement('div');
    card.className = 'variable-card';
    card.id = cardId;

    card.innerHTML = `
        <div class="variable-card-header" onclick="toggleCardBody('${cardId}')">
            <span><strong class="header-name">${escapeHtml(name) || 'New variable'}</strong></span>
        </div>
        <div class="variable-card-body" id="${cardId}-body">
            <div class="variable-inputs-row">
                <div>
                    <label>Variable name</label>
                    <input type="text" class="var-name-input" value="${escapeHtml(name)}" placeholder="e.g., n" required>
                </div>
                <div>
                    <label>Values (e.g., 1,2,3 or 1-5 or 1-6:2)</label>
                    <input type="text" class="var-expr-input" value="${escapeHtml(expr)}" placeholder="e.g., 1-5" required>
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
    const errorBox = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-btn');

    submitBtn.innerText = "Simulating...";
    submitBtn.disabled = true;
    errorBox.style.display = 'none';
    setHistoryOpen(false);

    // Pack active variables payload. The raw range string travels along so the
    // history can rebuild the variable cards exactly as they were typed.
    const payloadVariables = [];
    const varCards = variablesContainer.querySelectorAll('.variable-card');
    varCards.forEach(card => {
        const name = card.querySelector('.var-name-input').value.trim();
        const expr = card.querySelector('.var-expr-input').value;
        if (name) {
            payloadVariables.push({
                name: name,
                expr: expr,
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
            currentRunKey = historyKey(expressionInput, payloadVariables);
            renderResults(data);
            addHistoryEntry(expressionInput, payloadVariables, data);
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

// 5. Result rendering, shared by fresh simulations and restored history entries
function singleSummaryHTML(data) {
    return `
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
}

// A result display: its own controls, table, chart and view state. Cloned from the
// page template, so the current run and the comparison panel behave identically.
let resultViewSeq = 0;

function createResultView(container, title) {
    const uid = ++resultViewSeq;
    container.innerHTML = '';
    container.appendChild(document.getElementById('result-view-template').content.cloneNode(true));

    container.querySelector('.result-title').innerText = title;
    const grid = container.querySelector('.result-grid');
    const controls = container.querySelector('.view-controls');
    const viewModeSelect = container.querySelector('.view-mode');
    const rowSelect = container.querySelector('.matrix-row-var');
    const colSelect = container.querySelector('.matrix-col-var');
    const metricSelect = container.querySelector('.matrix-metric');
    const sliceContainer = container.querySelector('.slice-controls');
    const table = container.querySelector('.summary-table');
    const chartSection = container.querySelector('.chart-section-wrapper');
    const canvas = container.querySelector('canvas');

    // Ids have to be unique per instance for the labels to point at the right select
    container.querySelectorAll('.control-item').forEach((item, idx) => {
        const label = item.querySelector('label');
        const select = item.querySelector('select');
        if (!label || !select) return;
        select.id = `result-view-${uid}-control-${idx}`;
        label.setAttribute('for', select.id);
    });

    let data = null;
    let chartInstance = null;
    // Fixed values for variables that are not on either matrix axis, keyed by name
    let sliceSelections = {};
    // Tracks whether the user picked a view here; until then the matrix is the default
    let userChoseView = false;

    function render(newData) {
        data = newData;

        if (data.mode === 'single') {
            // SINGLE MODE: Show Chart, Render 1x3 metric table
            grid.className = 'result-grid dashboard-grid single-mode';
            chartSection.style.display = 'block';
            controls.style.display = 'none';

            table.className = 'summary-table';
            table.innerHTML = singleSummaryHTML(data);
            renderChart(data.chart_data);

        } else {
            // VARIABLE SWEEP MODE: Hide Chart, render sweep table (list or matrix)
            grid.className = 'result-grid dashboard-grid'; // 1 Full column width grid
            chartSection.style.display = 'none';
            controls.style.display = 'flex';

            setupControls();
            renderMulti();
        }
    }

    // Populate the axis dropdowns, keeping the user's previous picks when still valid
    function setupControls() {
        const names = data.variables_ordered;

        // A matrix needs two axes; fall back to the list view with a single variable
        viewModeSelect.querySelector('option[value="matrix"]').disabled = names.length < 2;
        if (names.length < 2) {
            viewModeSelect.value = 'list';
        } else if (!userChoseView) {
            // Matrix is the default whenever there are enough variables for one
            viewModeSelect.value = 'matrix';
        }

        fillVarOptions(rowSelect, names, rowSelect.value);
        const previousCol = colSelect.value;
        const colPreferred = (names.includes(previousCol) && previousCol !== rowSelect.value)
            ? previousCol
            : names.find(n => n !== rowSelect.value);
        fillVarOptions(colSelect, names, colPreferred);
    }

    function renderMulti() {
        if (!data || data.mode === 'single') return;

        const isMatrix = viewModeSelect.value === 'matrix' && data.variables_ordered.length >= 2;
        controls.querySelectorAll('.matrix-only').forEach(el => {
            el.style.display = isMatrix ? 'flex' : 'none';
        });

        if (!isMatrix) {
            table.className = 'summary-table';
            table.innerHTML = buildListTable(data);
            return;
        }

        const rowVar = rowSelect.value;
        // Both axes must differ; nudge the column axis off the row variable if needed
        if (colSelect.value === rowVar) {
            colSelect.value = data.variables_ordered.find(n => n !== rowVar);
        }
        const colVar = colSelect.value;

        renderSliceControls(rowVar, colVar);
        table.className = 'summary-table matrix-table';
        table.innerHTML = buildMatrixTable(data, rowVar, colVar, metricSelect.value, sliceSelections);
    }

    // Dropdowns fixing the value of every variable that isn't on an axis
    function renderSliceControls(rowVar, colVar) {
        const others = data.variables_ordered.filter(n => n !== rowVar && n !== colVar);
        sliceContainer.innerHTML = '';

        others.forEach((name, idx) => {
            const values = uniqueValues(data, name);
            if (!values.some(v => String(v) === String(sliceSelections[name]))) {
                sliceSelections[name] = values[0];
            }

            const selectId = `result-view-${uid}-slice-${idx}`;
            const wrapper = document.createElement('div');
            wrapper.className = 'control-item';
            wrapper.innerHTML = `
                <label for="${selectId}">${escapeHtml(name)} =</label>
                <select id="${selectId}">
                    ${values.map(v => `<option value="${v}"${String(v) === String(sliceSelections[name]) ? ' selected' : ''}>${v}</option>`).join('')}
                </select>
            `;
            wrapper.querySelector('select').addEventListener('change', (e) => {
                sliceSelections[name] = e.target.value;
                renderMulti();
            });
            sliceContainer.appendChild(wrapper);
        });
    }

    function renderChart(chartData) {
        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Probability',
                        data: chartData.probabilities,
                        backgroundColor: chartData.cumulative.map(getPlasmaColor),
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

    [viewModeSelect, rowSelect, colSelect, metricSelect].forEach(select => {
        select.addEventListener('change', renderMulti);
    });
    viewModeSelect.addEventListener('change', () => { userChoseView = true; });

    return { render };
}

const mainView = createResultView(document.getElementById('main-result-view'), 'Result Summary');
const comparisonView = createResultView(document.getElementById('comparison-view'), 'Previous Result Summary');

function renderResults(data) {
    document.getElementById('dashboard').style.display = 'block';
    mainView.render(data);
}

// 6. Table builders shared by every result view (flat list vs. two-variable matrix)
const HEAT_METRICS = ['mean', 'median', 'std'];

function formatMetric(metric, value) {
    if (typeof value !== 'number' || !isFinite(value)) return '—';
    // Medians of integer distributions are integers; keep them free of noise decimals
    return metric === 'median' && Number.isInteger(value) ? String(value) : value.toFixed(3);
}

// How much plasma survives the blend toward white; lower means softer cells
const HEAT_INTENSITY = 0.7;

// Plasma fill scaled between min and max, with text kept readable on both ends
function heatStyle(value, min, max) {
    if (typeof value !== 'number' || !isFinite(value)) return '';

    const t = max > min ? (value - min) / (max - min) : 0.5;
    const plasma = getPlasmaRGB(t);
    const blend = channel => Math.round(channel * HEAT_INTENSITY + 255 * (1 - HEAT_INTENSITY));
    const [r, g, b] = [blend(plasma.r), blend(plasma.g), blend(plasma.b)];

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return `background-color: rgb(${r}, ${g}, ${b}); color: ${luminance > 0.5 ? '#1e293b' : '#f8fafc'};`;
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

function buildMatrixTable(data, rowVar, colVar, metric, slices) {
    const rowValues = uniqueValues(data, rowVar);
    const colValues = uniqueValues(data, colVar);
    const fixedVars = data.variables_ordered.filter(n => n !== rowVar && n !== colVar);

    // Index the sweep results by (row value, column value) for the current slice
    const cells = new Map();
    data.results.forEach(r => {
        const combo = r.combination;
        if (!fixedVars.every(n => String(combo[n]) === String(slices[n]))) return;
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

// 7. Expression history, kept in localStorage on this browser only
const HISTORY_KEY = 'diceroller.history.v1';
const MAX_HISTORY = 10;
const historyToggle = document.getElementById('history-toggle');
const historyPanel = document.getElementById('history-panel');

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function loadHistory() {
    try {
        const stored = JSON.parse(localStorage.getItem(HISTORY_KEY));
        return Array.isArray(stored) ? stored : [];
    } catch (err) {
        console.warn('Could not read expression history:', err);
        return [];
    }
}

function saveHistory(entries) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    } catch (err) {
        // Almost certainly the storage quota; keep the newest half and retry once
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, Math.ceil(entries.length / 2))));
        } catch (retryErr) {
            console.warn('Could not save expression history:', retryErr);
        }
    }
}

// An entry is identified by its inputs, so re-running the same setup just moves it to the top
function historyKey(expression, variables) {
    return JSON.stringify([expression, (variables || []).map(v => [v.name, v.values])]);
}

function addHistoryEntry(expression, variables, data) {
    const key = historyKey(expression, variables);
    const entries = loadHistory().filter(e => historyKey(e.expression, e.variables) !== key);
    entries.unshift({ expression, variables, data, timestamp: Date.now() });
    saveHistory(entries.slice(0, MAX_HISTORY));
    renderHistoryPanel();
    refreshComparison();
}

function formatAge(timestamp) {
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    return `${Math.round(hours / 24)} d ago`;
}

function historySummary(entry) {
    const vars = (entry.variables || [])
        .map(v => `${v.name} = ${v.expr || (v.values || []).join(',')}`)
        .join(', ');
    const outcome = entry.data.mode === 'single'
        ? `mean ${entry.data.mean.toFixed(2)}`
        : `${entry.data.results.length} combinations`;
    return [vars, outcome, formatAge(entry.timestamp)].filter(Boolean).join(' · ');
}

// Fills a dropdown panel with recorded runs; used by both the expression field
// and the comparison picker, which differ only in what picking one does
function renderEntryList(panel, entries, onPick, emptyText) {
    if (!entries.length) {
        panel.innerHTML = `<div class="history-empty">${escapeHtml(emptyText)}</div>`;
        return;
    }

    panel.innerHTML = entries.map((entry, idx) => `
        <button type="button" class="history-item" data-index="${idx}">
            <span class="history-expression">${escapeHtml(entry.expression)}</span>
            <span class="history-meta">${escapeHtml(historySummary(entry))}</span>
        </button>
    `).join('');

    panel.querySelectorAll('.history-item').forEach(button => {
        button.addEventListener('click', () => onPick(entries[Number(button.dataset.index)]));
    });
}

function setDropdownOpen(panel, toggle, open) {
    panel.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
}

function renderHistoryPanel() {
    renderEntryList(historyPanel, loadHistory(), (entry) => {
        applyHistoryEntry(entry);
        setHistoryOpen(false);
    }, 'No simulations recorded yet.');
}

// Restore a recorded run: its expression, its variable cards and its saved results
function applyHistoryEntry(entry) {
    document.getElementById('expression').value = entry.expression;

    variablesContainer.innerHTML = '';
    (entry.variables || []).forEach(v => createVariableCard(v.name, v.expr || (v.values || []).join(',')));
    updateVariableCount();

    document.getElementById('error-message').style.display = 'none';
    currentRunKey = historyKey(entry.expression, entry.variables);
    renderResults(entry.data);
    refreshComparison();
}

function setHistoryOpen(open) {
    setDropdownOpen(historyPanel, historyToggle, open);
}

historyToggle.addEventListener('click', (e) => {
    e.stopPropagation(); // keep the outside-click handler below from closing it immediately
    const opening = !historyPanel.classList.contains('open');
    if (opening) {
        renderHistoryPanel();
        setPickerOpen(false); // only one dropdown at a time
    }
    setHistoryOpen(opening);
});

document.addEventListener('click', (e) => {
    if (!historyPanel.contains(e.target)) setHistoryOpen(false);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setHistoryOpen(false);
});

renderHistoryPanel();

// 8. Comparison panel: a second summary, rendered from a recorded simulation
const compareArea = document.getElementById('comparison-area');
const compareButton = document.getElementById('compare-btn');
const comparisonPanel = document.getElementById('comparison-panel');
const comparisonPicker = document.querySelector('.comparison-picker');
const comparisonInput = document.getElementById('comparison-input');
const comparisonToggle = document.getElementById('comparison-picker-toggle');
const comparisonOptions = document.getElementById('comparison-options');

// Identifies the run on display, so it is not offered as its own comparison
let currentRunKey = null;
// The entry last looked at, so reopening the comparison returns to it
let lastComparisonKey = null;

function entryKey(entry) {
    return historyKey(entry.expression, entry.variables);
}

function comparableEntries() {
    return loadHistory().filter(e => entryKey(e) !== currentRunKey);
}

function setComparisonOpen(open) {
    comparisonPanel.classList.toggle('open', open);
    comparisonPicker.classList.toggle('open', open);
    compareButton.setAttribute('aria-expanded', String(open));
    compareButton.innerText = open ? 'Hide comparison' : 'Compare results';
    if (!open) setPickerOpen(false);
}

function setPickerOpen(open) {
    setDropdownOpen(comparisonOptions, comparisonToggle, open);
}

// Keeps the button and the entry list in step with the recorded history
function refreshComparison() {
    const entries = comparableEntries();
    compareArea.style.display = entries.length ? 'block' : 'none';

    if (!entries.length) {
        setComparisonOpen(false);
        return;
    }
    // While closed there is nothing to fill in, and a chart built inside a hidden
    // panel has no size to lay out in; the list is rebuilt when it opens
    if (!comparisonPanel.classList.contains('open')) return;

    renderEntryList(comparisonOptions, entries, (entry) => {
        lastComparisonKey = entryKey(entry);
        setPickerOpen(false);
        renderComparison();
    }, 'No other simulations recorded yet.');

    // Back to the last entry viewed, or the most recent one on a first look
    if (!entries.some(e => entryKey(e) === lastComparisonKey)) {
        lastComparisonKey = entryKey(entries[0]);
    }
    renderComparison();
}

function renderComparison() {
    const entry = comparableEntries().find(e => entryKey(e) === lastComparisonKey);
    if (!entry) return;

    comparisonInput.value = entry.expression;
    comparisonView.render(entry.data);
}

compareButton.addEventListener('click', () => {
    const opening = !comparisonPanel.classList.contains('open');
    setComparisonOpen(opening); // open first, so the view lays out at its real size
    if (opening) refreshComparison();
});

// The field is read-only, so clicking either it or the chevron opens the list
[comparisonToggle, comparisonInput].forEach(el => {
    el.addEventListener('click', (e) => {
        e.stopPropagation(); // keep the outside-click handler from closing it immediately
        setHistoryOpen(false); // only one dropdown at a time
        setPickerOpen(!comparisonOptions.classList.contains('open'));
    });
});

document.addEventListener('click', (e) => {
    if (!comparisonOptions.contains(e.target)) setPickerOpen(false);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setPickerOpen(false);
});

// 9. Plasma Colored Chart Renderer
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

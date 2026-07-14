let chartInstance = null; // Store chart instance to destroy/recreate cleanly

// Listen to Hotkey 's' or 'S' to focus & submit the form
document.addEventListener('keydown', (e) => {
    // If user is typing inside the input field, don't trigger hotkey submit
    if (document.activeElement.tagName === 'INPUT') return;
    
    if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        document.getElementById('calc-form').requestSubmit();
    }
});

document.getElementById('calc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const expressionInput = document.getElementById('expression').value;
    const dashboard = document.getElementById('dashboard');
    const errorBox = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-btn');

    // UI Loading state
    submitBtn.innerText = "Running...";
    submitBtn.disabled = true;
    errorBox.style.display = 'none';

    try {
        const response = await fetch('/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expression: expressionInput })
        });
        
        const data = await response.json();

        if (data.success) {
            // Update table text content
            document.getElementById('val-mean').innerText = data.mean.toFixed(3);
            document.getElementById('val-median').innerText = data.median;
            document.getElementById('val-std').innerText = data.std.toFixed(3);

            // Show dashboard area
            dashboard.style.display = 'block';

            // Draw/Update Chart.js visualization
            renderChart(data.chart_data);
        } else {
            dashboard.style.display = 'none';
            errorBox.innerText = `❌ ${data.error}`;
            errorBox.style.display = 'block';
        }
    } catch (err) {
        dashboard.style.display = 'none';
        errorBox.innerText = `❌ Server connection failed. Make sure your Flask app is running.`;
        errorBox.style.display = 'block';
    } finally {
        submitBtn.innerHTML = 'Simulate <span class="key-badge">S</span>';
        submitBtn.disabled = false;
    }
});

/**
 * Interpolates the Matplotlib "Plasma" colormap.
 * @param {number} t - A value between 0.0 and 1.0
 * @returns {string} - An rgb() color string
 */
function getPlasmaColor(t) {
  // Constrain t to [0, 1]
  t = Math.max(0, Math.min(1, t));

  // Key RGB anchors sampled directly from Matplotlib's plasma colormap (0 to 255)
  const plasmaPoints = [
    { r: 13,   g: 8,   b: 135 }, // 0.0   - Dark blue/violet
    { r: 75,   g: 3,   b: 161 }, // 0.16  - Purple
    { r: 125,  g: 3,   b: 168 }, // 0.33  - Deep Magenta
    { r: 168,  g: 34,  b: 150 }, // 0.5   - Magenta
    { r: 203,  g: 70,  b: 121 }, // 0.66  - Red/Pink
    { r: 229,  g: 107, b: 93  }, // 0.83  - Orange
    { r: 240,  g: 249, b: 33  }  // 1.0   - Bright Yellow
  ];

  // If at the boundaries, return early
  if (t === 0) return `rgb(${plasmaPoints[0].r}, ${plasmaPoints[0].g}, ${plasmaPoints[0].b})`;
  if (t === 1) {
    const last = plasmaPoints[plasmaPoints.length - 1];
    return `rgb(${last.r}, ${last.g}, ${last.b})`;
  }

  // Find which two control points t falls between
  const segmentCount = plasmaPoints.length - 1;
  const scaledT = t * segmentCount;
  const index = Math.floor(scaledT);
  const localT = scaledT - index; // Progress between the two points (0.0 to 1.0)

  const c1 = plasmaPoints[index];
  const c2 = plasmaPoints[index + 1];

  // Linearly interpolate RGB values
  const r = Math.round(c1.r + (c2.r - c1.r) * localT);
  const g = Math.round(c1.g + (c2.g - c1.g) * localT);
  const b = Math.round(c1.b + (c2.b - c1.b) * localT);

  return `rgb(${r}, ${g}, ${b})`;
}


function renderChart(chartData) {
    const ctx = document.getElementById('distributionChart').getContext('2d');
    
    // Destroy previous instance to prevent overlapping bugs
    if (chartInstance) {
        chartInstance.destroy();
    }

    // Generate a beautiful gradient mapped directly to each bar's cumulative probability
    const backgroundColors = chartData.cumulative.map(getPlasmaColor);

    // Initialize Chart.js configuration
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    // Bar Chart on primary Y-Axis (Colored by cumulative probability array)
                    label: 'Probability',
                    data: chartData.probabilities,
                    backgroundColor: backgroundColors,
                    borderWidth: 0,
                    yAxisID: 'y_probability',
                    order: 2
                },
                {
                    // Line Chart on secondary Y-Axis
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
                legend: {
                    display: true,
                    position: 'top',
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Roll Value',
                        font: { weight: 'bold' }
                    },
                    grid: { display: false }
                },
                y_probability: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Probability',
                        font: { weight: 'bold' }
                    },
                    min: 0,
                    grid: { color: '#f1f5f9' }
                },
                y_cumulative: {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Cumulative Probability',
                        font: { weight: 'bold' }
                    },
                    min: 0,
                    max: 1,
                    grid: { display: false }
                }
            }
        }
    });
}
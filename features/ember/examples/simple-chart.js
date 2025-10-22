// Example Asset Pack: Interactive Chart Generator
// Demonstrates data visualization and dynamic content

//@name interactive-chart
//@display-name Interactive Data Chart
//@version 1.0.0
//@description Create and customize interactive charts with real-time data
//@author Ember Community

// Configuration arguments
//@arg chart_title string "Sample Data Chart"
//@arg chart_type string "bar"
//@arg data_values string "10,25,15,30,20"
//@arg data_labels string "Jan,Feb,Mar,Apr,May"
//@arg chart_color string "#667eea"
//@arg show_legend boolean true

// Context fields
//@context-field chart_data array Current chart data points
//@context-field chart_insights string AI analysis of the data
//@context-field last_update string When chart was last modified

// Exported functions
//@export updateData
//@export analyzeData
//@export exportChart

// AI Instructions
//@ai-instructions This is an interactive chart showing: {chart_title}. Current data: {chart_data}. Provide insights about trends, patterns, or notable points. Latest analysis: {chart_insights}

// Chart state
const chartState = {
    title: getArg('chart_title'),
    type: getArg('chart_type'),
    values: getArg('data_values').split(',').map(v => parseFloat(v.trim()) || 0),
    labels: getArg('data_labels').split(',').map(l => l.trim()),
    color: getArg('chart_color'),
    showLegend: getArg('show_legend'),

    chartInstance: null,
    lastUpdate: new Date().toLocaleString()
};

function initializeChart() {
    // Main container
    const container = document.createElement('div');
    container.className = 'ember-chart-widget';
    container.style.cssText = `
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        border-radius: 15px;
        padding: 20px;
        margin: 10px 0;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        max-width: 800px;
    `;

    // Header with title and controls
    const header = createHeader();
    container.appendChild(header);

    // Chart canvas
    const chartContainer = document.createElement('div');
    chartContainer.style.cssText = `
        background: white;
        border-radius: 10px;
        padding: 20px;
        margin: 15px 0;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    `;

    const canvas = document.createElement('canvas');
    canvas.id = 'emberChart' + Date.now();
    canvas.width = 600;
    canvas.height = 400;
    chartContainer.appendChild(canvas);

    container.appendChild(chartContainer);

    // Data controls
    const controlsContainer = createControls();
    container.appendChild(controlsContainer);

    // Statistics display
    const statsContainer = createStatsDisplay();
    container.appendChild(statsContainer);

    root.appendChild(container);

    // Initialize Chart.js
    initializeChartJS(canvas);

    // Update context
    updateAllContextFields();
}

function createHeader() {
    const header = document.createElement('div');
    header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #2c3e50; font-size: 1.4em;">
                📊 ${chartState.title}
            </h3>
            <div style="display: flex; gap: 10px;">
                <button onclick="analyzeChartData()" style="
                    padding: 8px 12px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 0.8em;
                ">🔍 Analyze</button>
                <button onclick="exportChartData()" style="
                    padding: 8px 12px;
                    background: #27ae60;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 0.8em;
                ">💾 Export</button>
            </div>
        </div>
        <div style="font-size: 0.8em; color: #7f8c8d;">
            Last updated: ${chartState.lastUpdate}
        </div>
    `;
    return header;
}

function createControls() {
    const controlsDiv = document.createElement('div');
    controlsDiv.innerHTML = `
        <div style="background: rgba(255,255,255,0.8); padding: 15px; border-radius: 10px; margin: 15px 0;">
            <h4 style="margin: 0 0 15px 0; color: #2c3e50;">Chart Controls</h4>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #34495e;">Chart Type:</label>
                    <select id="chartTypeSelect" onchange="updateChartType(this.value)" style="
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #bdc3c7;
                        border-radius: 4px;
                        font-size: 0.9em;
                    ">
                        <option value="bar" ${chartState.type === 'bar' ? 'selected' : ''}>Bar Chart</option>
                        <option value="line" ${chartState.type === 'line' ? 'selected' : ''}>Line Chart</option>
                        <option value="pie" ${chartState.type === 'pie' ? 'selected' : ''}>Pie Chart</option>
                        <option value="doughnut" ${chartState.type === 'doughnut' ? 'selected' : ''}>Doughnut Chart</option>
                        <option value="radar" ${chartState.type === 'radar' ? 'selected' : ''}>Radar Chart</option>
                    </select>
                </div>

                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #34495e;">Data Values:</label>
                    <input type="text" id="dataValues" value="${chartState.values.join(', ')}"
                           placeholder="10, 20, 30, 40, 50"
                           onchange="updateChartData()"
                           style="
                               width: 100%;
                               padding: 8px;
                               border: 1px solid #bdc3c7;
                               border-radius: 4px;
                               font-size: 0.9em;
                           ">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #34495e;">Labels:</label>
                    <input type="text" id="dataLabels" value="${chartState.labels.join(', ')}"
                           placeholder="A, B, C, D, E"
                           onchange="updateChartData()"
                           style="
                               width: 100%;
                               padding: 8px;
                               border: 1px solid #bdc3c7;
                               border-radius: 4px;
                               font-size: 0.9em;
                           ">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #34495e;">Chart Title:</label>
                    <input type="text" id="chartTitle" value="${chartState.title}"
                           onchange="updateChartTitle(this.value)"
                           style="
                               width: 100%;
                               padding: 8px;
                               border: 1px solid #bdc3c7;
                               border-radius: 4px;
                               font-size: 0.9em;
                           ">
                </div>
            </div>

            <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="addDataPoint()" style="
                    padding: 8px 15px;
                    background: #2ecc71;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">➕ Add Point</button>
                <button onclick="removeLastPoint()" style="
                    padding: 8px 15px;
                    background: #e74c3c;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">➖ Remove Point</button>
                <button onclick="randomizeData()" style="
                    padding: 8px 15px;
                    background: #9b59b6;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">🎲 Randomize</button>
            </div>
        </div>
    `;
    return controlsDiv;
}

function createStatsDisplay() {
    const stats = calculateStats();
    const statsDiv = document.createElement('div');
    statsDiv.innerHTML = `
        <div style="background: rgba(255,255,255,0.8); padding: 15px; border-radius: 10px; margin: 15px 0;">
            <h4 style="margin: 0 0 15px 0; color: #2c3e50;">Data Statistics</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
                <div style="text-align: center; background: #ecf0f1; padding: 10px; border-radius: 5px;">
                    <div style="font-size: 1.2em; font-weight: bold; color: #2c3e50;">${stats.count}</div>
                    <div style="font-size: 0.8em; color: #7f8c8d;">Data Points</div>
                </div>
                <div style="text-align: center; background: #e8f8f5; padding: 10px; border-radius: 5px;">
                    <div style="font-size: 1.2em; font-weight: bold; color: #27ae60;">${stats.sum}</div>
                    <div style="font-size: 0.8em; color: #7f8c8d;">Total</div>
                </div>
                <div style="text-align: center; background: #eaf2ff; padding: 10px; border-radius: 5px;">
                    <div style="font-size: 1.2em; font-weight: bold; color: #3498db;">${stats.average}</div>
                    <div style="font-size: 0.8em; color: #7f8c8d;">Average</div>
                </div>
                <div style="text-align: center; background: #fdf2e9; padding: 10px; border-radius: 5px;">
                    <div style="font-size: 1.2em; font-weight: bold; color: #e67e22;">${stats.max}</div>
                    <div style="font-size: 0.8em; color: #7f8c8d;">Maximum</div>
                </div>
                <div style="text-align: center; background: #fdedec; padding: 10px; border-radius: 5px;">
                    <div style="font-size: 1.2em; font-weight: bold; color: #e74c3c;">${stats.min}</div>
                    <div style="font-size: 0.8em; color: #7f8c8d;">Minimum</div>
                </div>
            </div>
        </div>
    `;
    return statsDiv;
}

function initializeChartJS(canvas) {
    const ctx = canvas.getContext('2d');

    chartState.chartInstance = new Chart(ctx, {
        type: chartState.type,
        data: {
            labels: chartState.labels,
            datasets: [{
                label: chartState.title,
                data: chartState.values,
                backgroundColor: generateColors(chartState.values.length),
                borderColor: chartState.color,
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: chartState.title,
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: chartState.showLegend
                }
            },
            scales: chartState.type === 'pie' || chartState.type === 'doughnut' ? {} : {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                }
            }
        }
    });
}

// Utility functions
function calculateStats() {
    const values = chartState.values;
    const sum = values.reduce((a, b) => a + b, 0);
    return {
        count: values.length,
        sum: sum.toFixed(1),
        average: (sum / values.length).toFixed(1),
        max: Math.max(...values).toFixed(1),
        min: Math.min(...values).toFixed(1)
    };
}

function generateColors(count) {
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
    ];
    return colors.slice(0, count);
}

// Chart interaction functions
window.updateChartType = function(newType) {
    chartState.type = newType;
    chartState.chartInstance.destroy();

    const canvas = document.querySelector('canvas');
    initializeChartJS(canvas);
    updateAllContextFields();
};

window.updateChartData = function() {
    const valuesInput = document.getElementById('dataValues').value;
    const labelsInput = document.getElementById('dataLabels').value;

    chartState.values = valuesInput.split(',').map(v => parseFloat(v.trim()) || 0);
    chartState.labels = labelsInput.split(',').map(l => l.trim());
    chartState.lastUpdate = new Date().toLocaleString();

    chartState.chartInstance.data.labels = chartState.labels;
    chartState.chartInstance.data.datasets[0].data = chartState.values;
    chartState.chartInstance.data.datasets[0].backgroundColor = generateColors(chartState.values.length);
    chartState.chartInstance.update();

    refreshStats();
    updateAllContextFields();

    ember.inject({
        content: `Updated chart data. New values: [${chartState.values.join(', ')}]. Labels: [${chartState.labels.join(', ')}].`,
        id: 'chart_data_update'
    });
};

window.updateChartTitle = function(newTitle) {
    chartState.title = newTitle;
    chartState.chartInstance.options.plugins.title.text = newTitle;
    chartState.chartInstance.data.datasets[0].label = newTitle;
    chartState.chartInstance.update();
    updateAllContextFields();
};

window.addDataPoint = function() {
    const newValue = Math.floor(Math.random() * 50) + 10;
    const newLabel = 'Point ' + (chartState.values.length + 1);

    chartState.values.push(newValue);
    chartState.labels.push(newLabel);

    document.getElementById('dataValues').value = chartState.values.join(', ');
    document.getElementById('dataLabels').value = chartState.labels.join(', ');

    updateChartData();
};

window.removeLastPoint = function() {
    if (chartState.values.length > 1) {
        chartState.values.pop();
        chartState.labels.pop();

        document.getElementById('dataValues').value = chartState.values.join(', ');
        document.getElementById('dataLabels').value = chartState.labels.join(', ');

        updateChartData();
    }
};

window.randomizeData = function() {
    chartState.values = chartState.values.map(() => Math.floor(Math.random() * 100) + 1);
    document.getElementById('dataValues').value = chartState.values.join(', ');
    updateChartData();

    ember.inject({
        content: `Randomized chart data! New values: [${chartState.values.join(', ')}].`,
        id: 'chart_randomize'
    });
};

window.analyzeChartData = function() {
    const stats = calculateStats();
    const trend = chartState.values.length > 1 ?
        (chartState.values[chartState.values.length - 1] > chartState.values[0] ? 'increasing' : 'decreasing') : 'stable';

    const analysis = `Chart Analysis: ${chartState.values.length} data points with average of ${stats.average}. Range from ${stats.min} to ${stats.max}. Overall trend appears to be ${trend}.`;

    ember.setContextField('chart_insights', analysis);

    ember.inject({
        content: analysis,
        id: 'chart_analysis'
    });
};

window.exportChartData = function() {
    const data = {
        title: chartState.title,
        type: chartState.type,
        data: chartState.values,
        labels: chartState.labels,
        exported: new Date().toISOString()
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `chart-data-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    ember.inject({
        content: `Exported chart data: "${chartState.title}" with ${chartState.values.length} data points.`,
        id: 'chart_export'
    });
};

function refreshStats() {
    // Update statistics display
    const statsContainer = document.querySelector('.ember-chart-widget > div:last-child');
    if (statsContainer) {
        const newStats = createStatsDisplay();
        statsContainer.replaceWith(newStats);
    }
}

function updateAllContextFields() {
    ember.setContextField('chart_data', chartState.values);
    ember.setContextField('last_update', chartState.lastUpdate);
}

// Exported functions
window.updateData = function(newValues, newLabels) {
    if (newValues) chartState.values = newValues;
    if (newLabels) chartState.labels = newLabels;

    document.getElementById('dataValues').value = chartState.values.join(', ');
    document.getElementById('dataLabels').value = chartState.labels.join(', ');

    updateChartData();
};

window.analyzeData = analyzeChartData;
window.exportChart = exportChartData;

// Initialize
initializeChart();

// Initial context injection
ember.inject({
    content: `Interactive chart "${chartState.title}" created with ${chartState.values.length} data points: [${chartState.values.join(', ')}]. Ready for data analysis and visualization.`,
    id: 'chart_init'
});
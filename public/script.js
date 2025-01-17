const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const crashHistory = document.getElementById("crashHistory");
let previousCrashes = [];

canvas.width = 800;
canvas.height = 400;

function updateCrashHistory(crashPoint) {
    if (crashPoint) {
        previousCrashes.unshift(crashPoint);
        if (previousCrashes.length > 7) {
            previousCrashes.pop();
        }
    }
    
    crashHistory.innerHTML = previousCrashes.map((point, index) => {
        const prevPoint = previousCrashes[index + 1] || point;
        const isWin = point > prevPoint;
        const color = isWin ? '#4CAF50' : '#ff4444';
        return `<span class="crash-point" style="color: ${color}">${point}×</span>`;
    }).join('');
}

// Initialize grid labels
function initializeGridLabels() {
    const yLabels = document.querySelector('.y-axis-labels');
    yLabels.innerHTML = ''; // Clear existing labels
    const xLabels = document.querySelector('.x-axis-labels');
    // Initialize time markers container
    xLabels.innerHTML = '<div class="time-markers"></div>';
}

// Update y-axis labels based on current multiplier
function updateYAxisLabels(currentMultiplier) {
    const yLabels = document.querySelector('.y-axis-labels');
    yLabels.innerHTML = '';
    
    const maxLabel = Math.min(Math.ceil(currentMultiplier) + 2, 10);
    for (let i = maxLabel; i >= 1; i--) {
        const label = document.createElement('div');
        label.textContent = i + 'x';
        yLabels.appendChild(label);
    }
}

// Update time markers
function updateTimeMarkers(currentTime) {
    const timeMarkers = document.querySelector('.time-markers');
    const startTime = Math.max(0, Math.floor(currentTime) - 7);
    const endTime = startTime + 8;
    
    let markers = '';
    for (let i = startTime; i <= endTime; i++) {
        if (i >= 0) {
            const position = ((i - startTime) / 8) * 100;
            markers += `<div class="time-marker" style="left: ${position}%">${i}s</div>`;
        }
    }
    timeMarkers.innerHTML = markers;
}

let multiplier = 1.0;
let animationRunning = false;
let path = [];

function drawCurve() {
    ctx.beginPath();
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 3;
    
    if (path.length > 0) {
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
    }
}

// Draw the Grid
function drawGrid() {
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 4]);
    ctx.setLineDash([4, 4]);

    // Horizontal Grid Lines
    for (let i = 1; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - i * 40);
        ctx.lineTo(canvas.width, canvas.height - i * 40);
        ctx.stroke();
    }

    // Vertical Grid Lines
    for (let i = 1; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 60, 0);
        ctx.lineTo(i * 60, canvas.height);
        ctx.stroke();
    }

    ctx.setLineDash([]);
}

function calculatePoint(multiplier) {
    let x, y;
    const startX = 50;
    const startY = canvas.height - 50;
    
    if (multiplier <= 2.0) {
        x = startX + (multiplier - 1) * 100;
        y = startY;
    } else {
        x = startX + 100 + (multiplier - 2) * 80;
        y = startY - Math.pow(multiplier - 2, 1.8) * 30;
    }
    return { x, y };
}

function updateCanvas() {
    if (!animationRunning) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawCurve();
    requestAnimationFrame(updateCanvas);
}

// WebSocket Logic
const ws = new WebSocket('ws://localhost:5000');
const currentMultiplierDisplay = document.getElementById("currentMultiplier");

ws.onmessage = event => {
    const data = JSON.parse(event.data);

    switch (data.event) {
        case 'waiting':
            // Interval between rounds
            multiplier = 1.0;
            animationRunning = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            path = [];
            drawGrid();
            currentMultiplierDisplay.innerText = `STARTING IN ${data.countdown}s`;
            currentMultiplierDisplay.style.color = '#aaa';
            currentMultiplierDisplay.style.fontSize = '48px';
            break;

        case 'game_start':
            // New round starts
            multiplier = 1.0; // Reset multiplier
            animationRunning = true; // Start animation
            currentMultiplierDisplay.innerText = '1.00×'; // Initial multiplier
            currentMultiplierDisplay.style.color = '#eee';
            currentMultiplierDisplay.style.fontSize = '144px';
            path = [calculatePoint(1.0)]; // Initialize path
            updateYAxisLabels(1.0); // Initialize y-axis labels
            updateCanvas(); // Start animation loop
            break;

        case 'progress':
            // Update multiplier during the game
            multiplier = parseFloat(data.multiplier);
            currentMultiplierDisplay.innerText = `${multiplier.toFixed(2)}×`; // Display multiplier
            currentMultiplierDisplay.style.color = '#fff';
            updateTimeMarkers((multiplier - 1.0) * 3); // Update time markers
            updateYAxisLabels(multiplier); // Update y-axis labels
            path.push(calculatePoint(multiplier)); // Add point to path
            break;

        case 'crash':
            // End of the round
            animationRunning = false; // Stop animation
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
            drawGrid(); // Redraw the grid
            drawCurve(); // Draw final curve
            currentMultiplierDisplay.innerHTML = `BUSTED<br>@ ${data.multiplier}×`; // Crash message on two lines
            currentMultiplierDisplay.style.color = '#ff4444';
            currentMultiplierDisplay.style.fontSize = '120px';
            updateCrashHistory(data.multiplier);
            break;

        default:
            console.log("Unknown event:", data);
    }
};

// Initialize grid labels on load
initializeGridLabels();
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 600;
canvas.height = 400;

// Spaceship Image
const spaceshipImage = new Image();
spaceshipImage.src = 'ufo.png'; // Ensure this file is in the same directory

// Animation State
let multiplier = 1.0; // Game multiplier
let spaceshipLoaded = false; // Track spaceship image loading
let horizontalDistance = 200; // Horizontal movement distance
let verticalCurveFactor = 10; // Curvature steepness
let animationRunning = false; // Animation control

// Spaceship Loaded Callback
spaceshipImage.onload = () => {
    spaceshipLoaded = true;
    console.log("Spaceship image loaded!");
};
spaceshipImage.onerror = () => {
    console.error("Spaceship image failed to load. Check the file name or path.");
};

// Draw the Grid
function drawGrid() {
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 0.5;
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

// Draw Spaceship
function drawSpaceship(multiplier) {
    if (!spaceshipLoaded) {
        console.warn("Spaceship image not loaded yet.");
        return;
    }

    // Calculate Spaceship Position
    let x, y;

    if (multiplier <= 2.0) {
        // Horizontal Movement Phase
        x = multiplier * (horizontalDistance / 2); // Move horizontally
        y = canvas.height - 40; // Stay near the bottom
    } else {
        // Upward Curvature Phase
        x = horizontalDistance + (multiplier - 2.0) * 80; // Continue horizontal motion
        y = Math.max(canvas.height - 40 - Math.pow(multiplier - 2.0, 2) * verticalCurveFactor, 50); // Curved trajectory with height cap
    }

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    // Draw Spaceship
    ctx.drawImage(spaceshipImage, x - 20, y - 30, 40, 40); // Center and scale spaceship
}

// Animation Update Function
function updateSpaceship() {
    if (!animationRunning) return; // Stop animation if not running

    multiplier += 0.02; // Increment multiplier slowly
    drawSpaceship(multiplier);

    if (multiplier < 10) {
        requestAnimationFrame(updateSpaceship); // Continue animation
    } else {
        animationRunning = false; // Stop animation when multiplier exceeds the limit
    }
}

// WebSocket Logic
const ws = new WebSocket('ws://localhost:8080');
const currentMultiplierDisplay = document.getElementById("currentMultiplier");

ws.onmessage = event => {
    const data = JSON.parse(event.data);

    switch (data.event) {
        case 'waiting':
            // Interval between rounds
            multiplier = 1.0; // Reset multiplier
            animationRunning = false; // Stop animation
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
            drawGrid(); // Redraw the grid
            currentMultiplierDisplay.innerText = `STARTING IN ${data.countdown}s`; // Countdown message
            break;

        case 'game_start':
            // New round starts
            multiplier = 1.0; // Reset multiplier
            animationRunning = true; // Start animation
            currentMultiplierDisplay.innerText = '1.00x'; // Initial multiplier
            updateSpaceship(); // Start animation loop
            break;

        case 'progress':
            // Update multiplier during the game
            multiplier = parseFloat(data.multiplier);
            currentMultiplierDisplay.innerText = `${multiplier.toFixed(2)}x`; // Display multiplier
            drawSpaceship(multiplier); // Update spaceship position
            break;

        case 'crash':
            // End of the round
            animationRunning = false; // Stop animation
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
            drawGrid(); // Redraw the grid
            currentMultiplierDisplay.innerText = `BUSTED @ ${data.multiplier}x`; // Crash message
            break;

        default:
            console.log("Unknown event:", data);
    }
};

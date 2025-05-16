// Get the canvas and its 2D context
const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");

// Resize the canvas to always fill the window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Draw a single particle as a square
function drawParticle(x, y, color, size) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
}

// Generate a random X and Y position within the canvas
function randomX() {
    return Math.random() * canvas.width;
}
function randomY() {
    return Math.random() * canvas.height;
}

// Store all particles for drawing
const allParticles = [];

// Particle factory
function makeParticle(x, y, color) {
    return {
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        color: color
    };
}

// Create a group of particles of a given color and add them to the global array
function makeGroup(count, color) {
    const group = [];
    for (let i = 0; i < count; i++) {
        const particle = makeParticle(randomX(), randomY(), color);
        group.push(particle);
        allParticles.push(particle);
    }
    return group;
}

// Apply a force rule between two groups of particles
function applyRule(groupA, groupB, force) {
    for (let i = 0; i < groupA.length; i++) {
        let fx = 0;
        let fy = 0;
        let particleA = groupA[i];
        for (let j = 0; j < groupB.length; j++) {
            let particleB = groupB[j];
            let dx = particleA.x - particleB.x;
            let dy = particleA.y - particleB.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0 && distance < 80) {
                let F = force * 1 / distance;
                fx += (F * dx) * 0.5;
                fy += (F * dy) * 0.5;
            }
        }
        // Update velocity and position
        particleA.vx = (particleA.vx + fx) * 0.5;
        particleA.vy = (particleA.vy + fy) * 0.5;
        particleA.x += particleA.vx;
        particleA.y += particleA.vy;
        // Bounce off walls
        if (particleA.x < 0 || particleA.x > canvas.width) {
            particleA.vx *= -1;
        }
        if (particleA.y < 0 || particleA.y > canvas.height) {
            particleA.vy *= -1;
        }
    }
}

// Create groups for each color
const yellowParticles = makeGroup(1000, "yellow");
const redParticles = makeGroup(1000, "red");
const greenParticles = makeGroup(1000, "green");

// Animation loop
function animate() {
    // Apply interaction rules between groups
    applyRule(greenParticles, greenParticles, -0.32);
    applyRule(greenParticles, redParticles, -0.17);
    applyRule(greenParticles, yellowParticles, 0.34);
    applyRule(redParticles, redParticles, -0.10);
    applyRule(redParticles, greenParticles, -0.34);
    applyRule(yellowParticles, yellowParticles, 0.15);
    applyRule(yellowParticles, greenParticles, -0.20);

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all particles
    for (let i = 0; i < allParticles.length; i++) {
        drawParticle(allParticles[i].x, allParticles[i].y, allParticles[i].color, 5);
    }

    requestAnimationFrame(animate);
}

animate();
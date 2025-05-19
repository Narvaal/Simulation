import * as THREE from 'three';
import * as screen from './screen.js';

// === Simulation Parameters ===
const SIM_WIDTH = 100;
const SIM_HEIGHT = 100;
const WALL_THRESHOLD = 1;
const WALL_FORCE = 2;    // Try a higher value
const WALL_SPRING = 10;  // Try a higher value
const FRAME_DURATION = 1000 / 60; // 60 FPS
let simulationSpeed = 0.5; // User can change this

// Store all particles and their meshes
let allParticles = [];
let grabbedParticles = [];
let mouseCircle, mouseSimX = 0, mouseSimY = 0;
let lastFrameTime = 0;

 // FPS calculation variables
let lastFpsUpdate = 0;
let frames = 0;
let fps = 0;

// Draw 
const canvas = document.querySelector('#bg');
console.log(canvas); // Should not be null

const scene = new THREE.Scene();

// Camera at the center of the simulation grid, looking at the center
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
);
camera.position.set(SIM_WIDTH / 2, SIM_HEIGHT / 2, 70);
camera.lookAt(SIM_WIDTH / 2, SIM_HEIGHT / 2, 0);

const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setClearColor(0x222222);
renderer.setSize(window.innerWidth, window.innerHeight);

const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(20, 20, 20);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Random position within [0, SIM_WIDTH] and [0, SIM_HEIGHT]
function randomX() { return Math.random() * SIM_WIDTH; }
function randomY() { return Math.random() * SIM_HEIGHT; }

// Particle definition
function makeParticle(x, y, color, options = {}) {
    const {
        initialSize = 0.5,
        shrinkRate = 0.001,
        grabRadius = 3,
        minDist = 1.0,
        repulseForce = 0.1,
        friction = 0.95,
        forceRadius = 80,
        enableEat = true,
        enableShrink = true
    } = options;

    const geometry = new THREE.IcosahedronGeometry(initialSize, 1);
    const material = new THREE.MeshStandardMaterial({ color: color, wireframe: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, 0);
    scene.add(mesh);

    return {
        x, y,
        vx: 0, vy: 0,
        color,
        mesh,
        size: initialSize,
        initialSize,
        shrinkRate,
        grabRadius,
        minDist,
        repulseForce,
        friction,
        forceRadius,
        enableEat,
        enableShrink
    };
}

// Group creation
function makeGroup(count, color, options = {}) {
    const group = [];
    for (let i = 0; i < count; i++) {
        const particle = makeParticle(randomX(), randomY(), color, options);
        group.push(particle);
        allParticles.push(particle);
    }
    return group;
}

// Wall forces
function applyWallForces(particle) {
    if (particle.x < 0) {
        particle.x = 0;
        particle.vx = Math.abs(particle.vx);
    }
    if (particle.x > SIM_WIDTH) {
        particle.x = SIM_WIDTH;
        particle.vx = -Math.abs(particle.vx);
    }
    if (particle.y < 0) {
        particle.y = 0;
        particle.vy = Math.abs(particle.vy);
    }
    if (particle.y > SIM_HEIGHT) {
        particle.y = SIM_HEIGHT;
        particle.vy = -Math.abs(particle.vy);
    }
    // Optionally keep your soft wall force for smoother effect
}

// Apply a force rule between two groups of particles
function applyRule(groupA, groupB, force) {
    for (let i = 0; i < groupA.length; i++) {
        let fx = 0, fy = 0;
        let particleA = groupA[i];
        let forceRadius = particleA.forceRadius || 80;
        let minDist = particleA.minDist || 1.0;
        let repulseForce = particleA.repulseForce || 0.1;
        let friction = particleA.friction || 0.95;

        for (let j = 0; j < groupB.length; j++) {
            let particleB = groupB[j];
            let dx = particleA.x - particleB.x;
            let dy = particleA.y - particleB.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0 && distance < forceRadius) {
                let F = force * 1 / distance;
                fx += (F * dx) * 0.5;
                fy += (F * dy) * 0.5;
            }
            // Strong repulsion if too close (atom-like)
            if (distance > 0 && distance < minDist) {
                let safeDist = Math.max(distance, 0.01);
                let repulse = repulseForce * (minDist - distance);
                // Clamp repulse to a lower value, e.g. 0.2
                repulse = Math.min(repulse, 0.2);
                fx += (dx / safeDist) * repulse;
                fy += (dy / safeDist) * repulse;
            }
        }
        // Update velocity and position with friction
        particleA.vx = ((particleA.vx + fx * simulationSpeed) * 0.5) * friction;
        particleA.vy = ((particleA.vy + fy * simulationSpeed) * 0.5) * friction;
        particleA.x += particleA.vx * simulationSpeed;
        particleA.y += particleA.vy * simulationSpeed;

        applyWallForces(particleA);
    }
}

// Mouse circle
function createMouseCircle() {
    const geometry = new THREE.CircleGeometry(4, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0, transparent: true });
    mouseCircle = new THREE.Mesh(geometry, material);
    mouseCircle.position.set(SIM_WIDTH / 2, SIM_HEIGHT / 2, 1);
    mouseCircle.visible = false;
    scene.add(mouseCircle);

    // White border
    const borderGeometry = new THREE.EdgesGeometry(geometry);
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    mouseCircle.add(border);
}
createMouseCircle();

// Mouse event listener
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
    vector.unproject(camera);

    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));

    mouseSimX = pos.x;
    mouseSimY = pos.y;

    if (mouseCircle) {
        mouseCircle.position.x = mouseSimX;
        mouseCircle.position.y = mouseSimY;
    }
});

canvas.addEventListener('mousedown', () => {
    if (mouseCircle) mouseCircle.visible = true;
    grabbedParticles = [];
    for (const particle of allParticles) {
        const dx = particle.x - mouseSimX;
        const dy = particle.y - mouseSimY;
        const grabRadius = particle.grabRadius || 3;
        if (Math.sqrt(dx * dx + dy * dy) < grabRadius) {
            grabbedParticles.push({
                particle: particle,
                offsetX: dx,
                offsetY: dy
            });
        }
    }
});
canvas.addEventListener('mouseup', () => {
    if (mouseCircle) mouseCircle.visible = false;
    grabbedParticles = [];
});

// Create groups
const redParticles = makeGroup(800,"red", {
    initialSize: 0.7,
    shrinkRate: 0,
    grabRadius: 4,
    minDist: 1.2,
    repulseForce: 0.2,
    friction: 0.99,
    forceRadius: 10,
    enableEat: false, 
    enableShrink: false
});
const yellowParticles = makeGroup(800, "yellow", {
    initialSize: 0.5,
    shrinkRate: 0,
    grabRadius: 3,
    minDist: 1.0,
    repulseForce: 0.1,
    friction: 0.95,
    forceRadius: 5,
    enableEat: false,
    enableShrink: false
});
const greenParticles = makeGroup(800, "green", {
    initialSize: 0.6,
    shrinkRate: 0,
    grabRadius: 3.5,
    minDist: 1.1,
    repulseForce: 0.15,
    friction: 0.99,
    forceRadius: 50,
    enableEat: false,
    enableShrink: false
});

// Eat mechanic: merge overlapping particles
let enableEat = true; // Set to false to disable the eat mechanic
function eatParticles() {
    for (let i = allParticles.length - 1; i >= 0; i--) {
        const pA = allParticles[i];
        if (!pA.enableEat) continue;
        for (let j = allParticles.length - 1; j > i; j--) {
            const pB = allParticles[j];
            if (!pB.enableEat) continue;
            const dx = pA.x - pB.x;
            const dy = pA.y - pB.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const eatDist = (pA.size + pB.size) * 0.5 * 0.8;
            if (dist < eatDist) {
                if (pA.size >= pB.size) {
                    const areaA = Math.PI * pA.size * pA.size;
                    const areaB = Math.PI * pB.size * pB.size;
                    const newArea = areaA + areaB;
                    pA.size = Math.sqrt(newArea / Math.PI);
                    scene.remove(pB.mesh);
                    allParticles.splice(j, 1);
                } else {
                    const areaA = Math.PI * pA.size * pA.size;
                    const areaB = Math.PI * pB.size * pB.size;
                    const newArea = areaA + areaB;
                    pB.size = Math.sqrt(newArea / Math.PI);
                    scene.remove(pA.mesh);
                    allParticles.splice(i, 1);
                    break;
                }
            }
        }
    }
}

// Shrink and remove dead particles
function shrinkAndRemoveParticles() {
    for (let i = allParticles.length - 1; i >= 0; i--) {
        const particle = allParticles[i];
        if (particle.enableShrink) {
            const shrink = (particle.shrinkRate !== undefined) ? particle.shrinkRate : 0.001;
            particle.size -= shrink;
        }
        if (particle.size <= 0) {
            scene.remove(particle.mesh);
            allParticles.splice(i, 1);
            continue;
        }
        particle.mesh.scale.set(
            particle.size / particle.initialSize,
            particle.size / particle.initialSize,
            particle.size / particle.initialSize
        );
        particle.mesh.position.x = particle.x;
        particle.mesh.position.y = particle.y;
    }
}

window.paused = false;

// Animation loop
function animate(now) {
    requestAnimationFrame(animate);

    // Always update grabbed particles and their mesh positions
    for (const grabbed of grabbedParticles) {
        grabbed.particle.x = mouseSimX + grabbed.offsetX;
        grabbed.particle.y = mouseSimY + grabbed.offsetY;
        grabbed.particle.vx = 0;
        grabbed.particle.vy = 0;
        // Update mesh position so it moves visually even when paused
        grabbed.particle.mesh.position.x = grabbed.particle.x;
        grabbed.particle.mesh.position.y = grabbed.particle.y;
    }

    if (!window.paused) {
        if (now - lastFrameTime < FRAME_DURATION) return;

        // FPS calculation (only for actual simulation frames)
        frames++;
        if (now - lastFpsUpdate > 1000) { // update every second
            fps = Math.round((frames * 1000) / (now - lastFpsUpdate));
            lastFpsUpdate = now;
            frames = 0;
            const fpsLabel = document.getElementById('fps');
            if (fpsLabel) fpsLabel.textContent = fps;
        }

        lastFrameTime = now;

        applyRule(redParticles, redParticles, -0.10);
        applyRule(redParticles, yellowParticles, -0.9);
        applyRule(redParticles, greenParticles, 0.55);

        applyRule(yellowParticles, redParticles, 0.5);
        applyRule(yellowParticles, yellowParticles, 0.5);
        applyRule(yellowParticles, greenParticles, 0.5);

        applyRule(greenParticles, redParticles, 0.1);
        applyRule(greenParticles, yellowParticles, -0.5);
        applyRule(greenParticles, greenParticles, 0.2);

        if (enableEat) {
            eatParticles();
        }
        shrinkAndRemoveParticles();
    }

    renderer.render(scene, camera);
}

animate();
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// === Simulation area parameters ===
const SIM_WIDTH = 100;
const SIM_HEIGHT = 100;

// Store all particles and their meshes
const allParticles = [];

// Particle creation
function makeParticle(x, y, color, size) {
    const geometry = new THREE.IcosahedronGeometry(size, 1);
    const material = new THREE.MeshStandardMaterial({ color: color, wireframe: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, 0);
    scene.add(mesh);

    return {
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        color: color,
        mesh: mesh
    };
}

// Random position within [0, SIM_WIDTH] and [0, SIM_HEIGHT]
function randomX() {
    return Math.random() * SIM_WIDTH;
}
function randomY() {
    return Math.random() * SIM_HEIGHT;
}

// Group creation
function makeGroup(count, color) {
    const group = [];
    for (let i = 0; i < count; i++) {
        const particle = makeParticle(randomX(), randomY(), color, 0.5);
        group.push(particle);
        allParticles.push(particle);
    }
    return group;
}

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

// Grid centered on simulation area
const gridHelper = new THREE.GridHelper(SIM_WIDTH, 10);
gridHelper.position.set(SIM_WIDTH / 2, SIM_HEIGHT / 2, 0);
gridHelper.scale.y = SIM_HEIGHT / SIM_WIDTH;

gridHelper.rotation.x = Math.PI / 2;
scene.add(gridHelper);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(SIM_WIDTH / 2, SIM_HEIGHT / 2, 0);
controls.update();

// Wall repulsion parameters
const wallThreshold = 1;
const wallForce = 0.5; 
const wallSpring = 5; // Try 0.05 to 0.2 for a springy feel

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
        particleA.vx = (particleA.vx + fx * simulationSpeed) * 0.5;
        particleA.vy = (particleA.vy + fy * simulationSpeed) * 0.5;
        particleA.x += particleA.vx * simulationSpeed;
        particleA.y += particleA.vy * simulationSpeed;

        if (particleA.x < wallThreshold) {
            particleA.vx += wallForce * (wallThreshold - particleA.x) * simulationSpeed;
        }
        if (particleA.x > SIM_WIDTH - wallThreshold) {
            particleA.vx -= wallForce * (particleA.x - (SIM_WIDTH - wallThreshold)) * simulationSpeed;
        }
        if (particleA.y < wallThreshold) {
            particleA.vy += wallForce * (wallThreshold - particleA.y) * simulationSpeed;
        }
        if (particleA.y > SIM_HEIGHT - wallThreshold) {
            particleA.vy -= wallForce * (particleA.y - (SIM_HEIGHT - wallThreshold)) * simulationSpeed;
        }

        // "Rubber band" effect
        if (particleA.x < 0) {
            particleA.vx += wallSpring * (-particleA.x) * simulationSpeed;
        }
        if (particleA.x > SIM_WIDTH) {
            particleA.vx -= wallSpring * (particleA.x - SIM_WIDTH) * simulationSpeed;
        }
        if (particleA.y < 0) {
            particleA.vy += wallSpring * (-particleA.y) * simulationSpeed;
        }
        if (particleA.y > SIM_HEIGHT) {
            particleA.vy -= wallSpring * (particleA.y - SIM_HEIGHT) * simulationSpeed;
        }
    }
}

const yellowParticles = makeGroup(100, "yellow");
const redParticles = makeGroup(100, "red");
const greenParticles = makeGroup(100, "green");

let lastFrameTime = 0;
const FRAME_DURATION = 1000 / 60; // 60 FPS
let simulationSpeed = 0.1; // 1.0 = normal speed, <1 = slower, >1 = faster

// Add at the top, after your imports and before animate()
let mouseCircle;
let mouseSimX = 0;
let mouseSimY = 0;

// Create the circle mesh (2D disk)
function createMouseCircle() {
    const geometry = new THREE.CircleGeometry(3, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0, transparent: true });
    mouseCircle = new THREE.Mesh(geometry, material);
    mouseCircle.position.set(SIM_WIDTH / 2, SIM_HEIGHT / 2, 1);
    mouseCircle.visible = false; // Hide by default
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

    // Always update the circle's position
    if (mouseCircle) {
        mouseCircle.position.x = mouseSimX;
        mouseCircle.position.y = mouseSimY;
    }
});

let grabbedParticles = [];
const grabRadius = 3; // Same as your circle radius

canvas.addEventListener('mousedown', () => {
    if (mouseCircle) mouseCircle.visible = true;
    // Find particles inside the circle and store their offset
    grabbedParticles = [];
    for (const particle of allParticles) {
        const dx = particle.x - mouseSimX;
        const dy = particle.y - mouseSimY;
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

// In your animate() function, update grabbed particles' positions:
function animate(now) {
    requestAnimationFrame(animate);

    if (now - lastFrameTime < FRAME_DURATION) return;
    lastFrameTime = now;

    applyRule(greenParticles, greenParticles, -0.32);
    applyRule(greenParticles, redParticles, -0.17);
    applyRule(greenParticles, yellowParticles, 0.34);
    applyRule(redParticles, redParticles, -0.10);
    applyRule(redParticles, greenParticles, -0.34);
    applyRule(yellowParticles, yellowParticles, 0.15);
    applyRule(yellowParticles, greenParticles, -0.20);

    // Move grabbed particles to follow the mouse circle
    for (const grabbed of grabbedParticles) {
        grabbed.particle.x = mouseSimX + grabbed.offsetX;
        grabbed.particle.y = mouseSimY + grabbed.offsetY;
        grabbed.particle.vx = 0;
        grabbed.particle.vy = 0;
    }

    // Update mesh positions to match particle data
    for (const particle of allParticles) {
        particle.mesh.position.x = particle.x;
        particle.mesh.position.y = particle.y;
    }

    renderer.render(scene, camera);
    controls.update();
}

animate();
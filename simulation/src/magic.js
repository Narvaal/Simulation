import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Detect if user is on a phone (simple check)
function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

// =====================
// SIMULATION CONFIG
// =====================
const SIZE = isMobile() ? 200 : 400; 
const NUM_CELLS_PER_GROUP = isMobile() ? 30 : 200;
const CELL_SIZE_MIN = 0.3;
const CELL_SIZE_MAX = 0.6;
const FORCE_RADIUS_MIN = 10;
const FORCE_RADIUS_MAX = 40;
const CELL_TRANSPARENCY_MIN = 30;
const CELL_TRANSPARENCY_MAX = 100;
const INITIAL_VELOCITY_SCALE = 1.2;
const CIRCLE_SPAWN_RADIUS = SIZE;
const COLLISION_SEPARATION = 3;
const COLLISION_DAMPING = 0.85;
const NOISE_FORCE = 0.04;
const ALIGN_RADIUS_FACTOR = 2.5;
const ALIGN_FORCE = 0.12;
const COHESION_FORCE = 0.0006;
const CENTER_ATTRACT = 0.00003;
const SIMULATION_GRAVITY = 1.2;
let g = SIMULATION_GRAVITY;

// =====================
// THREE.JS SETUP
// =====================
const canvas = document.querySelector('#bg');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
camera.position.set(SIZE / 2, SIZE / 2, 100);
camera.lookAt(SIZE / 2, SIZE / 2, 0);

const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setClearColor(0x000000);
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.target.set(SIZE / 2, SIZE / 2, 0);
controls.update();
controls.mouseButtons.LEFT = THREE.NONE;
if (isMobile()) {
    controls.enableRotate = false;
    controls.enableZoom = true;
    controls.enablePan = true;
}

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(0, 0, 100);
scene.add(dirLight);

// =====================
// GLOBALS
// =====================
let allCells = [];
let shockActive = false;
let paused = false;

// =====================
// CONTROL BUTTONS
// =====================
function setSimSpeed(val) {
    g = val;
}

const pauseBtn = document.getElementById('btn-pause');
document.getElementById('btn-0_5x').addEventListener('change', function() {
    if (this.checked) {
        setSimSpeed(SIMULATION_GRAVITY * 0.5);
        if (paused) {
            paused = false;
            pauseBtn.classList.remove('active');
            pauseBtn.textContent = 'Pause';
            g = SIMULATION_GRAVITY * 0.5;
        }
    }
});
document.getElementById('btn-1x').addEventListener('change', function() {
    if (this.checked) {
        setSimSpeed(SIMULATION_GRAVITY);
        if (paused) {
            paused = false;
            pauseBtn.classList.remove('active');
            pauseBtn.textContent = 'Pause';
            g = SIMULATION_GRAVITY;
        }
    }
});
document.getElementById('btn-2x').addEventListener('change', function() {
    if (this.checked) {
        setSimSpeed(SIMULATION_GRAVITY * 2);
        if (paused) {
            paused = false;
            pauseBtn.classList.remove('active');
            pauseBtn.textContent = 'Pause';
            g = SIMULATION_GRAVITY * 2;
        }
    }
});
pauseBtn.addEventListener('click', function () {
    paused = !paused;
    if (paused) {
        g = 0;
        shockActive = false;
        pauseBtn.classList.add('active');
        pauseBtn.textContent = 'Resume';
    } else {
        g = SIMULATION_GRAVITY;
        pauseBtn.classList.remove('active');
        pauseBtn.textContent = 'Pause';
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        if (paused) {
            paused = false;
            g = SIMULATION_GRAVITY * 2;
            pauseBtn.classList.remove('active');
            pauseBtn.textContent = 'Pause';
        } else {
            g = SIMULATION_GRAVITY * 2;
        }
        shockActive = true;
    }
});
canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        shockActive = false;
        g = SIMULATION_GRAVITY;
    }
});
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        if (paused) {
            paused = false;
            g = SIMULATION_GRAVITY * 2;
            pauseBtn.classList.remove('active');
            pauseBtn.textContent = 'Pause';
        } else {
            g = SIMULATION_GRAVITY * 2;
        }
        shockActive = true;
    }
});
canvas.addEventListener('touchend', () => {
    shockActive = false;
    g = SIMULATION_GRAVITY;
});

// =====================
// CELL FUNCTIONS
// =====================
function drawCell(cell) {
    let mesh, membraneMesh;
    if (window.lympocyteModel) {
        mesh = window.lympocyteModel.clone(true);
        mesh.scale.set(cell.size, cell.size, cell.size);
        const angle = Math.random() * Math.PI * 2;
        const x = SIZE / 2 + Math.cos(angle) * CIRCLE_SPAWN_RADIUS;
        const y = SIZE / 2 + Math.sin(angle) * CIRCLE_SPAWN_RADIUS;
        mesh.position.set(x, y, 0);

        const membraneGeometry = new THREE.CircleGeometry(cell.size * 10, 32);
        const membraneMaterial = new THREE.MeshBasicMaterial({
            color: cell.color,
            transparent: true,
            opacity: 0.03,
            depthWrite: false
        });
        membraneMesh = new THREE.Mesh(membraneGeometry, membraneMaterial);
        membraneMesh.position.copy(mesh.position);
        membraneMesh.position.z -= 0.01;
        scene.add(membraneMesh);

        mesh.traverse(child => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(mat => {
                        const newMat = mat.clone();
                        if (newMat.color) newMat.color.set(cell.color);
                        newMat.transparent = true;
                        newMat.opacity = (cell.transparency ?? 100) / 100;
                        return newMat;
                    });
                } else {
                    child.material = child.material.clone();
                    if (child.material.color) child.material.color.set(cell.color);
                    child.material.transparent = true;
                    child.material.opacity = (cell.transparency ?? 100) / 100;
                }
            }
        });
    } else {
        const geometry = new THREE.IcosahedronGeometry(cell.size * 0.1, 1);
        const material = new THREE.MeshStandardMaterial({
            color: cell.color,
            transparent: true,
            opacity: (cell.transparency ?? 100) / 100
        });
        const angle = Math.random() * Math.PI * 2;
        const x = SIZE / 2 + Math.cos(angle) * CIRCLE_SPAWN_RADIUS;
        const y = SIZE / 2 + Math.sin(angle) * CIRCLE_SPAWN_RADIUS;
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, 0);

        const membraneGeometry = new THREE.CircleGeometry(cell.size * 10, 32);
        const membraneMaterial = new THREE.MeshBasicMaterial({
            color: cell.color,
            transparent: true,
            opacity: 0.06,
            depthWrite: false
        });
        membraneMesh = new THREE.Mesh(membraneGeometry, membraneMaterial);
        membraneMesh.position.copy(mesh.position);
        membraneMesh.position.z -= 0.01;
        scene.add(membraneMesh);
    }
    scene.add(mesh);

    return {
        mesh,
        membraneMesh,
        vx: cell.vx * INITIAL_VELOCITY_SCALE,
        vy: cell.vy * INITIAL_VELOCITY_SCALE,
        size: cell.size,
        color: cell.color,
        forceRadius: cell.forceRadius ?? FORCE_RADIUS_MIN,
        transparency: cell.transparency ?? CELL_TRANSPARENCY_MAX,
        trails: cell.trails ?? false
    };
}

function makeCellsGroup(number, cell) {
    const cells = [];
    for (let i = 0; i < number; i++) cells.push(drawCell(cell));
    allCells.push(...cells);
    return cells;
}

function clearCells() {
    for (const cell of allCells) {
        scene.remove(cell.mesh);
        if (cell.membraneMesh) scene.remove(cell.membraneMesh);
    }
    allCells = [];
}

// =====================
// INTERACTION RULES
// =====================
function applyRule(groupA, groupB, force) {
    for (let i = 0; i < groupA.length; i++) {
        for (let j = 0; j < groupB.length; j++) {
            let dx = groupA[i].mesh.position.x - groupB[j].mesh.position.x;
            let dy = groupA[i].mesh.position.y - groupB[j].mesh.position.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
                let forceRadius = groupA[i].forceRadius;
                const minDist = (groupA[i].size + groupB[j].size) * COLLISION_SEPARATION;
                if (distance < minDist) {
                    const overlap = minDist - distance;
                    const nx = dx / distance;
                    const ny = dy / distance;

                    const correction = overlap / 2;
                    groupA[i].mesh.position.x += nx * correction;
                    groupA[i].mesh.position.y += ny * correction;
                    groupB[j].mesh.position.x -= nx * correction;
                    groupB[j].mesh.position.y -= ny * correction;

                    groupA[i].vx *= COLLISION_DAMPING;
                    groupA[i].vy *= COLLISION_DAMPING;
                    groupB[j].vx *= COLLISION_DAMPING;
                    groupB[j].vy *= COLLISION_DAMPING;
                } else {
                    if (distance <= forceRadius) {
                        let F = g * force / distance;
                        groupA[i].vx += (F * dx);
                        groupA[i].vy += (F * dy);
                    }
                }
            }
        }
    }
}

// =====================
// CELL ANIMATION
// =====================
function animateCells() {
    const cx = SIZE / 2, cy = SIZE / 2, simRadius = SIZE / 2;
    let nearWallCount = 0;
    const wallThreshold = simRadius - 8;

    for (const cell of allCells) {
        const dx = cell.mesh.position.x - cx;
        const dy = cell.mesh.position.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > wallThreshold) nearWallCount++;
    }

    for (const cell of allCells) {
        const friction = 1 - Math.min(0.05 * cell.size, 0.5);
        cell.vx *= friction;
        cell.vy *= friction;
        cell.mesh.position.x += cell.vx;
        cell.mesh.position.y += cell.vy;
        const speed = Math.sqrt(cell.vx * cell.vx + cell.vy * cell.vy);

        if (speed > 0.001) {
            cell.mesh.rotation.z = Math.atan2(cell.vy, cell.vx);
        }

        const dx = cell.mesh.position.x - cx;
        const dy = cell.mesh.position.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = simRadius - cell.size;
        if (dist > maxDist) {
            const angle = Math.atan2(dy, dx);
            cell.mesh.position.x = cx + Math.cos(angle) * maxDist;
            cell.mesh.position.y = cy + Math.sin(angle) * maxDist;
        }

        cell.vx += (cx - cell.mesh.position.x) * CENTER_ATTRACT * dist * g;
        cell.vy += (cy - cell.mesh.position.y) * CENTER_ATTRACT * dist * g;

        if (!window.paused && shockActive && g > 0) {
            const angle = Math.random() * Math.PI * 2;
            const strength = (1.5 + Math.random()) * g;
            cell.vx += Math.cos(angle) * strength;
            cell.vy += Math.sin(angle) * strength;
        }

        cell.vx += Math.sin(Date.now() * 0.001 + cell.mesh.position.x) * NOISE_FORCE * g;
        cell.vy += Math.cos(Date.now() * 0.001 + cell.mesh.position.y) * NOISE_FORCE * g;

        if (g === 0) {
            cell.vx = 0;
            cell.vy = 0;
        }
    }

    for (const cell of allCells) {
        let avgVX = 0, avgVY = 0, count = 0;
        let centerX = 0, centerY = 0;
        for (const other of allCells) {
            if (cell === other) continue;
            const dx = cell.mesh.position.x - other.mesh.position.x;
            const dy = cell.mesh.position.y - other.mesh.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < cell.forceRadius * ALIGN_RADIUS_FACTOR) {
                avgVX += other.vx;
                avgVY += other.vy;
                centerX += other.mesh.position.x;
                centerY += other.mesh.position.y;
                count++;
            }
        }
        if (count > 0 && g > 0) {
            avgVX /= count;
            avgVY /= count;
            centerX /= count;
            centerY /= count;
            cell.vx += (avgVX - cell.vx) * ALIGN_FORCE * g;
            cell.vy += (avgVY - cell.vy) * ALIGN_FORCE * g;
            cell.vx += (centerX - cell.mesh.position.x) * COHESION_FORCE * g;
            cell.vy += (centerY - cell.mesh.position.y) * COHESION_FORCE * g;
        }
    }

    for (const cell of allCells) {
        if (cell.membraneMesh) {
            cell.membraneMesh.position.copy(cell.mesh.position);
            cell.membraneMesh.rotation.z = 0;
        }
    }
}

// =====================
// GROUPS AND RULES MANAGEMENT
// =====================
const ruleForces = {
    blue_blue:    Math.random() * 1 - 0.5,
    blue_red:     Math.random() * 1 - 0.5,
    blue_yellow:  Math.random() * 1 - 0.5,
    blue_green:   Math.random() * 1 - 0.5,
    red_red:      Math.random() * 1 - 0.5,
    red_blue:     Math.random() * 1 - 0.5,
    red_yellow:   Math.random() * 1 - 0.5,
    red_green:    Math.random() * 1 - 0.5,
    yellow_yellow:Math.random() * 1 - 0.5,
    yellow_blue:  Math.random() * 1 - 0.5,
    yellow_red:   Math.random() * 1 - 0.5,
    yellow_green: Math.random() * 1 - 0.5,
    green_green:  Math.random() * 1 - 0.5,
    green_blue:   Math.random() * 1 - 0.5,
    green_red:    Math.random() * 1 - 0.5,
    green_yellow: Math.random() * 1 - 0.5,
};

function generateRandomCells() {
    clearCells();
    ruleForces.blue_blue    = Math.random() * 0.6 - 0.3;
    ruleForces.blue_red     = Math.random() * 0.6 - 0.3;
    ruleForces.blue_yellow  = Math.random() * 0.6 - 0.3;
    ruleForces.blue_green   = Math.random() * 0.6 - 0.3;
    ruleForces.red_red      = Math.random() * 0.6 - 0.3;
    ruleForces.red_blue     = Math.random() * 0.6 - 0.3;
    ruleForces.red_yellow   = Math.random() * 0.6 - 0.3;
    ruleForces.red_green    = Math.random() * 0.6 - 0.3;
    ruleForces.yellow_yellow= Math.random() * 0.6 - 0.3;
    ruleForces.yellow_blue  = Math.random() * 0.6 - 0.3;
    ruleForces.yellow_red   = Math.random() * 0.6 - 0.3;
    ruleForces.yellow_green = Math.random() * 0.6 - 0.3;
    ruleForces.green_green  = Math.random() * 0.6 - 0.3;
    ruleForces.green_blue   = Math.random() * 0.6 - 0.3;
    ruleForces.green_red    = Math.random() * 0.6 - 0.3;
    ruleForces.green_yellow = Math.random() * 0.6 - 0.3;

    window.yellow = makeCellsGroup(NUM_CELLS_PER_GROUP, {
        color: Math.floor(Math.random() * 0xffffff),
        size: Math.random() * 0.3 + 0.3,
        vx: 0,
        vy: 0,
        forceRadius: Math.random() * 20 + 1,
        transparency: Math.random() * 50 + 50
    });
    window.red = makeCellsGroup(NUM_CELLS_PER_GROUP, {
        color: Math.floor(Math.random() * 0xffffff),
        size: Math.random() * 0.3 + 0.3,
        vx: 0,
        vy: 0,
        forceRadius: Math.random() * 20 + 1,
        transparency: Math.random() * 50 + 50
    });
    window.blue = makeCellsGroup(NUM_CELLS_PER_GROUP, {
        color: Math.floor(Math.random() * 0xffffff),
        size: Math.random() * 0.3 + 0.3,
        vx: 0,
        vy: 0,
        forceRadius: Math.random() * 20 + 1,
        transparency: Math.random() * 50 + 50
    });
    window.green = makeCellsGroup(NUM_CELLS_PER_GROUP, {
        color: Math.floor(Math.random() * 0xffffff),
        size: Math.random() * 0.3 + 0.3,
        vx: 0,
        vy: 0,
        forceRadius: Math.random() * 20 + 1,
        transparency: Math.random() * 50 + 50
    });
}
document.getElementById('btn-random').addEventListener('click', generateRandomCells);

// =====================
// MODEL LOADING & INIT
// =====================
const loader = new GLTFLoader();
loader.load('/models/cell.glb', function(gltf) {
    gltf.scene.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    gltf.scene.position.sub(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const desiredRadius = 1;
    const scale = (desiredRadius * 2) / maxDim;
    gltf.scene.scale.set(scale, scale, scale);
    window.lympocyteModel = gltf.scene;
    generateRandomCells();
}, undefined, error => console.error(error));

// =====================
// ANIMATION LOOP
// =====================
function animate() {
    if (window.paused) {
        requestAnimationFrame(animate);
        return;
    }

    if (window.yellow && window.red && window.blue && window.green) {
        applyRule(window.blue, window.blue,     ruleForces.blue_blue);
        applyRule(window.blue, window.red,      ruleForces.blue_red);
        applyRule(window.blue, window.yellow,   ruleForces.blue_yellow);
        applyRule(window.blue, window.green,    ruleForces.blue_green);

        applyRule(window.red, window.red,       ruleForces.red_red);
        applyRule(window.red, window.blue,      ruleForces.red_blue);
        applyRule(window.red, window.yellow,    ruleForces.red_yellow);
        applyRule(window.red, window.green,     ruleForces.red_green);

        applyRule(window.yellow, window.yellow, ruleForces.yellow_yellow);
        applyRule(window.yellow, window.blue,   ruleForces.yellow_blue);
        applyRule(window.yellow, window.red,    ruleForces.yellow_red);
        applyRule(window.yellow, window.green,  ruleForces.yellow_green);

        applyRule(window.green, window.green,   ruleForces.green_green);
        applyRule(window.green, window.blue,    ruleForces.green_blue);
        applyRule(window.green, window.red,     ruleForces.green_red);
        applyRule(window.green, window.yellow,  ruleForces.green_yellow);
    }

    animateCells();
    controls.update();
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
}
animate();


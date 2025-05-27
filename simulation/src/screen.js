import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SIZE = 200;
const canvas = document.querySelector('#bg');
const scene = new THREE.Scene();
 let g = 0.1; // gravidade/força padrão

// Função para atualizar g conforme o botão
function setSimSpeed(val) {
    g = val;
}

// Listeners para os botões de velocidade
document.getElementById('btn-0_5x').addEventListener('change', function() {
    if (this.checked) setSimSpeed(0.05);
});
document.getElementById('btn-1x').addEventListener('change', function() {
    if (this.checked) setSimSpeed(0.1);
});
document.getElementById('btn-2x').addEventListener('change', function() {
    if (this.checked) setSimSpeed(0.2);
});
document.getElementById('btn-pause').addEventListener('click', function() {
    setSimSpeed(0);
});

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(SIZE / 2, SIZE / 2, 100);
camera.lookAt(SIZE / 2, SIZE / 2, 0);

const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setClearColor(0x222222);
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.target.set(SIZE / 2, SIZE / 2, 0);
controls.update();
controls.mouseButtons.LEFT = THREE.NONE;

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(0, 0, 100);
scene.add(dirLight);

let allCells = [];

function drawCell(cell) {
    let mesh;
    if (window.lympocyteModel) {
        mesh = window.lympocyteModel.clone(true);
        mesh.scale.set(cell.size, cell.size, cell.size);
        mesh.position.set(Math.random() * SIZE, Math.random() * SIZE, 0);
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
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(Math.random() * SIZE, Math.random() * SIZE, 0);
    }
    scene.add(mesh);

    return {
        mesh,
        vx: cell.vx,
        vy: cell.vy,
        size: cell.size,
        color: cell.color,
        forceRadius: cell.forceRadius ?? 5,
        transparency: cell.transparency ?? 100,
        trails: cell.trails ?? false
    };
}

function makeCellsGroup(number, cell) {
    const cells = [];
    for (let i = 0; i < number; i++) cells.push(drawCell(cell));
    allCells.push(...cells);
    return cells;
}

function applyRule(groupA, groupB, force) {
    for (let i = 0; i < groupA.length; i++) {
        for (let j = 0; j < groupB.length; j++) {
            let dx = groupA[i].mesh.position.x - groupB[j].mesh.position.x;
            let dy = groupA[i].mesh.position.y - groupB[j].mesh.position.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
                const minDist = groupA[i].size + groupB[j].size;
                // Se estiverem sobrepostos, aplica forte repulsão (efeito rígido)
                if (distance < minDist) {
                    const overlap = minDist - distance;
                    const safeDist = Math.max(distance, 0.01);
                    const nx = dx / safeDist;
                    const ny = dy / safeDist;
                    // Multiplica repulse por g
                    const repulse = Math.min(overlap * 0.05, 0.5) * g;
                    groupA[i].vx += (repulse * nx) / groupA[i].size;
                    groupA[i].vy += (repulse * ny) / groupA[i].size;
                    groupB[j].vx -= (repulse * nx) / groupB[j].size;
                    groupB[j].vy -= (repulse * ny) / groupB[j].size;
                } else {
                    // Força radial (atração/repulsão normal)
                    const forceRadius = Math.max(groupA[i].forceRadius, groupB[j].forceRadius);
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

let shockActive = false;

// Substitua os listeners globais por listeners apenas no canvas
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) shockActive = true; // botão esquerdo
});
canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) shockActive = false;
});

function animateCells() {
    const cx = SIZE / 2, cy = SIZE / 2, simRadius = SIZE / 2;
    let nearWallCount = 0;
    const wallThreshold = simRadius - 8;

    // Conta quantas partículas estão perto da parede
    for (const cell of allCells) {
        const dx = cell.mesh.position.x - cx;
        const dy = cell.mesh.position.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > wallThreshold) nearWallCount++;
    }

    // Se muitas partículas estão na parede, zere a atração ao centro
    // Caso contrário, aumente a atração proporcional à distância
    let centerAttract = 0.001; // ATRAÇÃO MAIS FORTE
    if (nearWallCount > allCells.length * 0.3) {
        centerAttract = 0.0;
    }

    for (const cell of allCells) {
        const friction = 1 - Math.min(0.05 * cell.size, 0.5);
        cell.vx *= friction;
        cell.vy *= friction;
        cell.mesh.position.x += cell.vx;
        cell.mesh.position.y += cell.vy;
        const speed = Math.sqrt(cell.vx * cell.vx + cell.vy * cell.vy);

        // Corrige a rotação: gira apenas se estiver se movendo e suaviza
        if (speed > 0.001) {
            // Rotação proporcional ao ângulo do movimento
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
            const vn = cell.vx * Math.cos(angle) + cell.vy * Math.sin(angle);
            cell.vx -= 0.5 * vn * Math.cos(angle);
            cell.vy -= 0.5 * vn * Math.sin(angle);
        }

        // Atração ao centro proporcional à distância
        if (centerAttract > 0) {
            cell.vx += (cx - cell.mesh.position.x) * centerAttract * dist / simRadius;
            cell.vy += (cy - cell.mesh.position.y) * centerAttract * dist / simRadius;
        }

        // SHOCK: aplica impulso aleatório enquanto o botão está pressionado
        if (shockActive) {
            const angle = Math.random() * Math.PI * 2;
            const strength = 1.5 + Math.random();
            cell.vx += Math.cos(angle) * strength;
            cell.vy += Math.sin(angle) * strength;
        }

        cell.vx += Math.sin(Date.now() * 0.001 + cell.mesh.position.x) * 0.01;
        cell.vy += Math.cos(Date.now() * 0.001 + cell.mesh.position.y) * 0.01;

        if (g === 0) {
            cell.vx = 0;
            cell.vy = 0;
        }
    }

    // Alinhamento e coesão (boids)
    for (const cell of allCells) {
        let avgVX = 0, avgVY = 0, count = 0;
        let centerX = 0, centerY = 0;
        for (const other of allCells) {
            if (cell === other) continue;
            const dx = cell.mesh.position.x - other.mesh.position.x;
            const dy = cell.mesh.position.y - other.mesh.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < cell.forceRadius * 1.5) {
                avgVX += other.vx;
                avgVY += other.vy;
                centerX += other.mesh.position.x;
                centerY += other.mesh.position.y;
                count++;
            }
        }
        if (count > 0 && g > 0) { // <-- só aplica boids se g > 0
            avgVX /= count;
            avgVY /= count;
            centerX /= count;
            centerY /= count;
            // Alinhamento
            cell.vx += (avgVX - cell.vx) * 0.02 * g;
            cell.vy += (avgVY - cell.vy) * 0.02 * g;
            // Coesão
            cell.vx += (centerX - cell.mesh.position.x) * 0.0002 * g;
            cell.vy += (centerY - cell.mesh.position.y) * 0.0002 * g;
        }
    }
}

// Carrega o modelo e cria as células
const loader = new GLTFLoader();
loader.load('/models/lympocyte.glb', function(gltf) {
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
    window.yellow = makeCellsGroup(200, { color: Math.floor(Math.random() * 0xffffff), size: Math.random() * 0.3 + 0.3, vx: 0, vy: 0, forceRadius: Math.random() * 20 + 1 , transparency: Math.random() * 50 + 50 });
    window.red = makeCellsGroup(200, { color: Math.floor(Math.random() * 0xffffff), size: Math.random() * 0.3 + 0.3, vx: 0, vy: 0, forceRadius: Math.random() * 20 + 1, transparency: Math.random() * 50 + 50 });
    window.blue = makeCellsGroup(200, { color: Math.floor(Math.random() * 0xffffff), size: Math.random() * 0.3 + 0.3, vx: 0, vy: 0, forceRadius: Math.random() * 20 + 1, transparency: Math.random() * 50 + 50 });
}, undefined, error => console.error(error));

// Gere os valores aleatórios uma única vez ao iniciar
const ruleForces = {
    blue_blue:    Math.random() * 0.6 - 0.3,
    blue_red:     Math.random() * 0.6 - 0.3,
    blue_yellow:  Math.random() * 0.6 - 0.3,
    red_red:      Math.random() * 0.6 - 0.3,
    red_blue:     Math.random() * 0.6 - 0.3,
    red_yellow:   Math.random() * 0.6 - 0.3,
    yellow_yellow:Math.random() * 0.6 - 0.3,
    yellow_blue:  Math.random() * 0.6 - 0.3,
    yellow_red:   Math.random() * 0.6 - 0.3
};

// ANIMATION LOOP
function animate() {
    if (window.yellow && window.red && window.blue) {
        applyRule(window.blue, window.blue,     ruleForces.blue_blue);
        applyRule(window.blue, window.red,      ruleForces.blue_red);
        applyRule(window.blue, window.yellow,   ruleForces.blue_yellow);

        applyRule(window.red, window.red,       ruleForces.red_red);
        applyRule(window.red, window.blue,      ruleForces.red_blue);
        applyRule(window.red, window.yellow,    ruleForces.red_yellow);

        applyRule(window.yellow, window.yellow, ruleForces.yellow_yellow);
        applyRule(window.yellow, window.blue,   ruleForces.yellow_blue);
        applyRule(window.yellow, window.red,    ruleForces.yellow_red);
    }

    animateCells();
    controls.update();
    renderer.render(scene, camera);

    requestAnimationFrame(animate);
}
animate();


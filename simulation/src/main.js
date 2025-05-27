import * as THREE from 'three';

// --- SIMULAÇÃO ---
const SIM_WIDTH = 100;
const SIM_HEIGHT = 100;
const FRAME_DURATION = 1000 / 60;
let simulationSpeed = 0.5;
let allParticles = [];
let grabbedParticles = [];
let mouseSimX = 0, mouseSimY = 0;
let lastFrameTime = 0;
let mode = 'interact';
let isMouseDown = false;
let userCells = [];
let userRules = [];
let windowPaused = false;

let dragging = false;
let draggedParticle = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

let mouseCircle = null;

const canvas = document.querySelector('#bg');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(SIM_WIDTH / 2, SIM_HEIGHT / 2, 70);
camera.lookAt(SIM_WIDTH / 2, SIM_HEIGHT / 2, 0);

const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setClearColor(0x222222);
renderer.setSize(window.innerWidth, window.innerHeight);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// --- PARTICLE ---
function makeParticle(x, y, options = {}) {
    const {
        color = 0xffffff,
        initialSize = 0.5,
        shrinkRate = 0.001,
        grabRadius = 3,
        minDist = 1.0,
        repulseForce = 0.1,
        friction = 0.95,
        forceRadius = 80,
        enableEat = true,
        enableShrink = true,
        userGroup = null
    } = options;

    const geometry = new THREE.IcosahedronGeometry(initialSize, 1);
    const material = new THREE.MeshStandardMaterial({ color, wireframe: false });
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
        enableShrink,
        userGroup
    };
}

// --- REGRAS ENTRE GRUPOS ---
function applyRule(groupA, groupB, force) {
    for (let i = 0; i < groupA.length; i++) {
        let fx = 0, fy = 0, a = groupA[i];
        for (let j = 0; j < groupB.length; j++) {
            let b = groupB[j];
            let dx = a.x - b.x, dy = a.y - b.y, dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0 && dist < a.forceRadius) {
                let F = force / dist;
                fx += (F * dx) * 0.5;
                fy += (F * dy) * 0.5;
            }
            if (dist > 0 && dist < a.minDist) {
                let safeDist = Math.max(dist, 0.01);
                let repulse = Math.min(a.repulseForce * (a.minDist - dist), 0.2);
                fx += (dx / safeDist) * repulse;
                fy += (dy / safeDist) * repulse;
            }
        }
        a.vx = ((a.vx + fx * simulationSpeed) * 0.5) * a.friction;
        a.vy = ((a.vy + fy * simulationSpeed) * 0.5) * a.friction;
        a.x += a.vx * simulationSpeed;
        a.y += a.vy * simulationSpeed;
        a.x = Math.max(0, Math.min(SIM_WIDTH, a.x));
        a.y = Math.max(0, Math.min(SIM_HEIGHT, a.y));
    }
}

// --- MOUSE ---
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
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

canvas.addEventListener('mousemove', () => {
    if (mode === 'interact' && dragging && grabbedParticles.length > 0) {
        for (const grabbed of grabbedParticles) {
            grabbed.particle.x = mouseSimX + grabbed.offsetX;
            grabbed.particle.y = mouseSimY + grabbed.offsetY;
            grabbed.particle.vx = 0;
            grabbed.particle.vy = 0;
        }
    }
});

canvas.addEventListener('mousedown', (event) => {
    if (mode === 'add') {
        addUserCellAtMouse();
        return;
    }
    if (mode === 'interact') {
        if (mouseCircle) mouseCircle.visible = true;
        grabbedParticles = [];
        const grabRadius = 4; // mesmo raio do círculo branco
        for (const p of allParticles) {
            const dx = p.x - mouseSimX;
            const dy = p.y - mouseSimY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < grabRadius) {
                grabbedParticles.push({
                    particle: p,
                    offsetX: p.x - mouseSimX,
                    offsetY: p.y - mouseSimY
                });
            }
        }
        dragging = grabbedParticles.length > 0;
    }
});

canvas.addEventListener('mouseup', () => {
    if (mode === 'interact') {
        if (mouseCircle) mouseCircle.visible = false;
        dragging = false;
        grabbedParticles = [];
        draggedParticle = null;
    }
});

// --- CELULAS DO USUARIO ---
function addUserCellAtMouse() {
    const idx = window.selectedUserCellIdx ?? (userCells.length - 1);
    const cell = userCells[idx];
    if (!cell) return;
    let colorValue = typeof cell.color === 'string' && cell.color.startsWith('#')
        ? parseInt(cell.color.replace('#', '0x'), 16)
        : cell.color;
    const particle = makeParticle(mouseSimX, mouseSimY, { ...cell, color: colorValue, userGroup: idx });
    allParticles.push(particle);
}

function saveUserCell(cellData) {
    let colorValue = typeof cellData.color === 'string' && cellData.color.startsWith('#')
        ? parseInt(cellData.color.replace('#', '0x'), 16)
        : cellData.color;
    cellData.color = colorValue;
    userCells.push(cellData);
    updateRuleCombos();
}

function updateRuleCombos() {
    const cellOptions = userCells.map((cell, idx) =>
        `<option value="${idx}">Célula ${idx + 1}</option>`
    ).join('');
    $('.cell-a, .cell-b').each(function() {
        const current = $(this).val();
        $(this).html('<option disabled selected>Escolha a célula</option>' + cellOptions);
        if (current !== null && current !== undefined && current !== '') {
            $(this).val(current);
        }
    });
}

// --- REGRAS DO USUARIO ---
$(document).on('click', '#add-rule-btn', function() {
    const cellOptions = userCells.map((cell, idx) =>
        `<option value="${idx}">Célula ${idx + 1}</option>`
    ).join('');
    const ruleIdx = userRules.length;
    $('#user-rules-list').append(`
      <div class="card p-2 mb-2" data-rule-idx="${ruleIdx}">
        <div class="row g-2 align-items-center">
          <div class="col">
            <select class="form-select cell-a">
              <option disabled selected>Escolha a célula A</option>
              ${cellOptions}
            </select>
          </div>
          <div class="col-auto">↔</div>
          <div class="col">
            <select class="form-select cell-b">
              <option disabled selected>Escolha a célula B</option>
              ${cellOptions}
            </select>
          </div>
        </div>
        <div class="mt-2 d-none slider-row">
          <label class="form-label mb-1">Força (-1 = atração, 1 = repulsão):</label>
          <input type="range" min="-1" max="1" step="0.01" value="0" class="form-range rule-force">
          <output class="force-value">0</output>
        </div>
      </div>
    `);
});

$(document).on('change', '.cell-a, .cell-b', function() {
    const $card = $(this).closest('.card');
    const a = $card.find('.cell-a').val();
    const b = $card.find('.cell-b').val();
    if (a !== null && b !== null && a !== undefined && b !== undefined && a !== '' && b !== '') {
        $card.find('.slider-row').removeClass('d-none');
    }
});

$(document).on('input', '.rule-force', function() {
    $(this).siblings('.force-value').text($(this).val());
    const $card = $(this).closest('.card');
    const a = parseInt($card.find('.cell-a').val());
    const b = parseInt($card.find('.cell-b').val());
    const force = parseFloat($(this).val());
    const idx = $card.data('rule-idx');
    if (Number.isInteger(a) && Number.isInteger(b)) {
        userRules[idx] = { a, b, force };
    } else {
        userRules[idx] = null;
    }
});

// --- BOTÕES E INTERFACE ---
$(function() {
    $('#add-button').on('click', function() {
        const $list = $('#user-cells-list');
        $list.empty();
        userCells.forEach((cell, idx) => {
            $list.append(
                `<li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>
                      <span style="display:inline-block;width:16px;height:16px;background:${cell.color};border-radius:50%;margin-right:8px;"></span>
                      Célula ${idx + 1}
                    </span>
                    <button class="btn btn-sm btn-primary" data-cell-idx="${idx}">Selecionar</button>
                </li>`
            );
        });
        const offcanvas = new bootstrap.Offcanvas(document.getElementById('user-cells-menu'));
        offcanvas.show();
    });

    $('#user-cells-list').on('click', 'button[data-cell-idx]', function() {
        const idx = $(this).data('cell-idx');
        window.selectedUserCellIdx = idx;
        mode = 'add';
        bootstrap.Offcanvas.getInstance(document.getElementById('user-cells-menu')).hide();
    });

    $('#interact-button').on('click', function() {
        mode = 'interact';
    });

    $('#clear-button').on('click', function(event) {
        event.preventDefault();
        for (const p of allParticles) scene.remove(p.mesh);
        allParticles = [];
    });

    $('#eletric-button').on('click', function(event) {
        event.preventDefault();
        for (const particle of allParticles) {
            const angle = Math.random() * 2 * Math.PI;
            const force = 50 + Math.random() * 100.0;
            particle.vx += Math.cos(angle) * force;
            particle.vy += Math.sin(angle) * force;
        }
    });

    $('#cell-save-btn').on('click', function() {
        const cellData = {
            initialSize: parseFloat($('#cell-initialSize').val()),
            shrinkRate: parseFloat($('#cell-shrinkRate').val()),
            grabRadius: parseFloat($('#cell-grabRadius').val()),
            minDist: parseFloat($('#cell-minDist').val()),
            repulseForce: parseFloat($('#cell-repulseForce').val()),
            friction: parseFloat($('#cell-friction').val()),
            forceRadius: parseFloat($('#cell-forceRadius').val()),
            enableEat: $('#cell-enableEat').is(':checked'),
            enableShrink: $('#cell-enableShrink').is(':checked'),
            color: $('#cell-color').val()
        };
        saveUserCell(cellData);
    });

    $('input[name="sim-speed"]').on('change', function() {
        if (this.id === 'btn-0_5x') simulationSpeed = 0.1;
        else if (this.id === 'btn-1x') simulationSpeed = 0.5;
        else if (this.id === 'btn-2x') simulationSpeed = 1.0;
    });

    $('#rule-button').on('click', function(event) {
        event.preventDefault();
        const offcanvas = new bootstrap.Offcanvas(document.getElementById('rules-menu'));
        offcanvas.show();
    });

    $('#btn-pause').on('click', function() {
        windowPaused = !windowPaused;
        $(this).toggleClass('btn-danger');
        $(this).text(windowPaused ? 'Resume' : 'Pause');
    });
});

// --- CIRCULO DO MOUSE ---
function createMouseCircle() {
    const geometry = new THREE.CircleGeometry(4, 64);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0, transparent: true });
    mouseCircle = new THREE.Mesh(geometry, material);
    mouseCircle.position.set(SIM_WIDTH / 2, SIM_HEIGHT / 2, 1);
    mouseCircle.visible = false;
    scene.add(mouseCircle);

    // Borda branca
    const borderGeometry = new THREE.EdgesGeometry(geometry);
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    mouseCircle.add(border);
}
createMouseCircle();

// --- ANIMAÇÃO ---
function animate(now) {
    requestAnimationFrame(animate);

    if (!windowPaused) {
        if (now - lastFrameTime < FRAME_DURATION) return;
        lastFrameTime = now;

        // Grupos do usuário (cada célula é um grupo)
        const userGroups = userCells.map((cell, idx) =>
            allParticles.filter(p => p.userGroup === idx)
        );

        // Aplica regras do usuário (se houver)
        for (const rule of userRules) {
            if (
                rule &&
                Number.isInteger(rule.a) &&
                Number.isInteger(rule.b) &&
                userGroups[rule.a] && userGroups[rule.b] &&
                userGroups[rule.a].length > 0 &&
                userGroups[rule.b].length > 0
            ) {
                applyRule(userGroups[rule.a], userGroups[rule.b], rule.force);
            }
        }
    }

    // Atualiza partículas (sempre, mesmo se não houver regras)
    for (let i = allParticles.length - 1; i >= 0; i--) {
        const p = allParticles[i];
        if (p.enableShrink) p.size -= p.shrinkRate;
        if (p.size <= 0) {
            scene.remove(p.mesh);
            allParticles.splice(i, 1);
            continue;
        }
        p.mesh.scale.set(p.size / p.initialSize, p.size / p.initialSize, p.size / p.initialSize);
        p.mesh.position.x = p.x;
        p.mesh.position.y = p.y;
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
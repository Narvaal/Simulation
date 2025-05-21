import {
    setMode,
    addUserCellAtMouse,
    saveUserCell,
    clearParticles,
    applyElectricForce
} from './main.js';

// Wait for DOM ready
$(function() {
    // Sidebar buttons
    const $interactBtn = $('#interact-button');
    const $clearBtn = $('#clear-button');
    const $eletricBtn = $('#eletric-button');
    const $cellBtn = $('#cell-button');
    const $addBtn = $('#add-button');

    // Control panel buttons
    const $btn1x = $('#btn-1x');
    const $btn2x = $('#btn-2x');
    const $btn3x = $('#btn-3x');
    const $btnPause = $('#btn-pause');

    const $fps = $('#fps');


    $('#btn-pause').on('click', function() {
        // Toggle the paused variable in main.js
        window.paused = !window.paused;
        $(this).toggleClass('btn-danger');
        $(this).text(window.paused ? 'Resume' : 'Pause');
    });

    $('#add-button').on('click', function() {
        setMode('add');
    });

    $('#interact-button').on('click', function() {
        setMode('interact');
    });

    $('#clear-button').on('click', function() {
        clearParticles();
    });

    $('#eletric-button').on('click', function() {
        applyElectricForce();
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

    // Pause button logic remains here
    $('#btn-pause').on('click', function() {
        window.paused = !window.paused;
        $(this).toggleClass('btn-danger');
        $(this).text(window.paused ? 'Resume' : 'Pause');
    });

    // Simulation speed radio buttons
    $('input[name="sim-speed"]').on('change', function() {
        if (this.id === 'btn-0_5x') window.simulationSpeed = 0.1;
        else if (this.id === 'btn-1x') window.simulationSpeed = 0.5;
        else if (this.id === 'btn-2x') window.simulationSpeed = 1.0;
    });
});

let isMouseDown = false;

canvas.addEventListener('mousedown', (e) => {
    if (mode === 'add') {
        isMouseDown = true;
        addUserCellAtMouse();
        e.stopPropagation();
        return;
    }
    if (mode !== 'interact') return;
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
    isMouseDown = false;
    if (mode !== 'interact') return;
    if (mouseCircle) mouseCircle.visible = false;
    grabbedParticles = [];
});

canvas.addEventListener('mousemove', () => {
    if (mode === 'add' && isMouseDown) {
        addUserCellAtMouse();
    }
});
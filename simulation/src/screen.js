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
});
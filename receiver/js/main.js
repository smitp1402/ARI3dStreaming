import * as THREE from 'three';
import { WebRTCManager } from './webrtc/WebRTCManager.js';
import { SceneManager } from './graphics/SceneManager.js';
import { InputManager } from './input/InputManager.js';

const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');

// Instantiate Managers
const webrtcManager = new WebRTCManager(remoteVideo);
const sceneManager = new SceneManager(remoteVideo);
const inputManager = new InputManager();

// Initialize Scene
sceneManager.init();

// State for Controller Selection
// We'll store the actual wrapper objects here
let selectedWrappers = [];

function updateHighlights() {
    // Hide all first
    if (sceneManager.vrManager.highlight1) sceneManager.vrManager.highlight1.visible = false;
    if (sceneManager.vrManager.highlight2) sceneManager.vrManager.highlight2.visible = false;

    // Show for selected
    selectedWrappers.forEach(wrapper => {
        // Identify which highlight belongs to the wrapper
        if (wrapper === sceneManager.vrManager.controller1Wrapper) {
            sceneManager.vrManager.highlight1.visible = true;
        } else if (wrapper === sceneManager.vrManager.controller2Wrapper) {
            sceneManager.vrManager.highlight2.visible = true;
        }
    });
}

// Handle Exit VR
inputManager.onEscape = () => {
    const session = sceneManager.renderer.xr.getSession();
    if (session) {
        session.end();
    }
};

// Start/Stop Stream Logic
if (startBtn) {
    let isStreaming = false;

    startBtn.addEventListener('click', () => {
        if (!isStreaming) {
            // START
            webrtcManager.startStream();

            // UI Updates
            startBtn.innerText = "Stop Stream";
            startBtn.style.backgroundColor = "#ff4444"; // Red for stop
            startBtn.style.color = "white";

            document.getElementById('instructions').style.display = 'none';
            remoteVideo.play().catch(e => console.log("Autoplay prevented:", e));

            isStreaming = true;
        } else {
            // STOP -> Reload page to reset everything cleanly
            window.location.reload();
        }
    });
}

// Start Render Loop with Movement Logic
sceneManager.startRenderLoop((delta, camera, userRig, renderer) => {
    const keyState = inputManager.getKeys();
    const moveSpeed = 3.0 * delta; // Meters per second

    // Select Controller
    // Controller 0 (Right) -> 'e'
    // Controller 1 (Left) -> 'q'
    // Both -> 'b'

    if (keyState.q) {
        selectedWrappers = [sceneManager.vrManager.controller2Wrapper]; // Left
        console.log("Left Controller Selected");
        updateHighlights();
    }
    if (keyState.e) {
        selectedWrappers = [sceneManager.vrManager.controller1Wrapper]; // Right
        console.log("Right Controller Selected");
        updateHighlights();
    }
    if (keyState.b) {
        selectedWrappers = [
            sceneManager.vrManager.controller1Wrapper,
            sceneManager.vrManager.controller2Wrapper
        ];
        console.log("Both Controllers Selected");
        updateHighlights();
    }

    // Move Selected Controller(s)
    if (selectedWrappers.length > 0) {
        // Arrow Keys for Controller Movement (Relative to User Rig/World)
        if (keyState.ArrowUp) {
            selectedWrappers.forEach(w => w.position.z -= moveSpeed);
        }
        if (keyState.ArrowDown) {
            selectedWrappers.forEach(w => w.position.z += moveSpeed);
        }
        if (keyState.ArrowLeft) {
            selectedWrappers.forEach(w => w.position.x -= moveSpeed);
        }
        if (keyState.ArrowRight) {
            selectedWrappers.forEach(w => w.position.x += moveSpeed);
        }
    }

    if (renderer.xr.isPresenting) {
        // Normal Player Movement (WASD)

        // Calculate Forward Direction
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        direction.normalize();

        // Calculate Right Direction
        const right = new THREE.Vector3();
        right.crossVectors(camera.up, direction).normalize();

        // Apply Movement
        if (keyState.w) userRig.position.addScaledVector(direction, moveSpeed);
        if (keyState.s) userRig.position.addScaledVector(direction, -moveSpeed);
        if (keyState.a) userRig.position.addScaledVector(right, moveSpeed);
        if (keyState.d) userRig.position.addScaledVector(right, -moveSpeed);
    }
});

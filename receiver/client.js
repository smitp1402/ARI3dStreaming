import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { VRButton } from 'https://unpkg.com/three@0.160.0/examples/jsm/webxr/VRButton.js';

// Use relative path so it works on localhost or IP or ngrok
const SIGNALING_URL = '';
const remoteVideo = document.getElementById('remoteVideo');

// WebRTC Setup
// WebRTC Setup
// WebRTC Setup
// WebRTC Setup
let pc;
let lastConsumedOfferSdp = null; // Track the last offer we tried to use

function createPeerConnection() {
    if (pc) {
        pc.close();
    }
    pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });


    pc.ontrack = (event) => {
        console.log("Stream received!");
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.play().catch(e => console.log("Autoplay error:", e));
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log("ICE State:", pc.iceConnectionState);
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
            console.log("Connection failed/disconnected. Retrying...");
            // Retry after 1s
            setTimeout(() => {
                console.log("Retrying connection...");
                startStream();
            }, 1000);
        }
    };
}

async function startStream() {
    // Clear any existing interval if we had one (cleanup from previous logic)
    // The restartCheckInterval variable is no longer used, so this block is effectively removed.

    try {
        console.log("Looking for offer...");
        let offer = null;

        // Polling loop to get a FRESH offer
        // If we have a lastConsumedOfferSdp, we want to wait until the server gives us something DIFFERENT.
        // This handles the race condition where Publisher is restarting but Server still has old offer.
        while (true) {
            const response = await fetch(`/offer`);
            if (response.ok) {
                const data = await response.json();

                if (lastConsumedOfferSdp && data.sdp === lastConsumedOfferSdp) {
                    console.log("Offer is stale (same as last failed attempt). Waiting for new offer...");
                    await new Promise(r => setTimeout(r, 1000)); // Wait 1s before checking again
                    continue;
                }

                offer = data;
                break; // Found a good offer
            } else {
                console.log("No offer waiting. Retrying in 1s...");
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        console.log("Found fresh offer. Connecting...");
        lastConsumedOfferSdp = offer.sdp; // Mark this as consumed

        createPeerConnection();

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await fetch(`/answer`, {
            method: 'POST',
            body: JSON.stringify(pc.localDescription),
            headers: { 'Content-Type': 'application/json' }
        });

        console.log("Answer sent!");

    } catch (e) {
        console.error("Error starting stream:", e);
        // If we errored, maybe clear lastConsumedOfferSdp or just let the retry logic handle it
        setTimeout(startStream, 2000);
    }
}

// Three.js Setup
// Three.js Setup
let camera, scene, renderer;
let userRig; // Group to move the user around
let videoTexture;
const clock = new THREE.Clock();

// Movement State
const keyState = {
    w: false,
    a: false,
    s: false,
    d: false
};

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);

    // User Rig for movement
    userRig = new THREE.Group();
    scene.add(userRig);
    userRig.add(camera);

    // WebXR RIG: User is always at 0,0,0. We move the world around them.
    // With userRig, we move the rig.
    userRig.position.set(0, 0, 0);
    camera.position.set(0, 0, 0);

    // Helpers
    const gridHelper = new THREE.GridHelper(20, 20, 0x404040, 0x404040);
    // Move grid down slightly so it feels like a floor
    gridHelper.position.y = -1.5;
    scene.add(gridHelper);

    // Layers: 0=Non-VR, 1=LeftEye, 2=RightEye
    // We want to be able to see something in Non-VR mode too. 
    // Typically WebXR manager sets camera layers automatically: Left=1, Right=2.
    // We'll create two meshes.

    remoteVideo.crossOrigin = "anonymous";
    videoTexture = new THREE.VideoTexture(remoteVideo);
    videoTexture.colorSpace = THREE.SRGBColorSpace;

    // Geometry
    // Assuming 16:9 aspect ratio for the whole video (SBS = 8:9 per eye roughly, or 16:9 per eye if packed differently)
    // Sizing: 1.6 width, 0.9 height
    const geometry = new THREE.PlaneGeometry(3.2, 0.9); // Wide plane to hold both? No.
    // We want one plane for Left Eye, one for Right Eye.

    // Left Eye Mesh
    const geometryLeft = new THREE.PlaneGeometry(4.8, 2.7);
    // UV Mapping: 0.0 to 0.5
    const uvsLeft = geometryLeft.attributes.uv;
    for (let i = 0; i < uvsLeft.count; i++) {
        uvsLeft.setX(i, uvsLeft.getX(i) * 0.5);
    }
    const materialLeft = new THREE.MeshBasicMaterial({ map: videoTexture });
    const meshLeft = new THREE.Mesh(geometryLeft, materialLeft);
    meshLeft.position.z = -3;
    meshLeft.layers.set(1); // Left Eye
    scene.add(meshLeft);

    // Right Eye Mesh
    const geometryRight = new THREE.PlaneGeometry(4.8, 2.7);
    // UV Mapping: 0.5 to 1.0
    const uvsRight = geometryRight.attributes.uv;
    for (let i = 0; i < uvsRight.count; i++) {
        uvsRight.setX(i, (uvsRight.getX(i) * 0.5) + 0.5);
    }
    const materialRight = new THREE.MeshBasicMaterial({ map: videoTexture });
    const meshRight = new THREE.Mesh(geometryRight, materialRight);
    meshRight.position.z = -3;
    meshRight.layers.set(2); // Right Eye
    scene.add(meshRight);

    // Default View (Non-VR): Just show the whole video nicely or one eye
    // Let's add a mesh on Layer 0 that shows the left eye only for 2D monitoring?
    // Or just show both side-by-side.
    const geometryMono = new THREE.PlaneGeometry(3.2, 0.9);
    const materialMono = new THREE.MeshBasicMaterial({ map: videoTexture });
    const meshMono = new THREE.Mesh(geometryMono, materialMono);
    meshMono.position.z = -3;
    meshMono.layers.set(0);
    scene.add(meshMono);


    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    container.appendChild(renderer.domElement);

    // Hide Mono mesh in VR, Show in Non-VR
    renderer.xr.addEventListener('sessionstart', () => {
        meshMono.visible = false;
    });
    renderer.xr.addEventListener('sessionend', () => {
        // Wait a small amount time for the XR session to fully detach
        setTimeout(() => {
            meshMono.visible = true;

            // Comprehensive Camera Reset
            userRig.position.set(0, 0, 0);
            userRig.rotation.set(0, 0, 0);
            camera.position.set(0, 0, 0);
            camera.lookAt(0, 0, -3); // Force camera to look at the screen
            camera.fov = 70;
            camera.updateProjectionMatrix(); // Important to update projection

            // Force resize
            onWindowResize();
        }, 100);
    });

    document.body.appendChild(VRButton.createButton(renderer));

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case 'w': keyState.w = true; break;
            case 'a': keyState.a = true; break;
            case 's': keyState.s = true; break;
            case 'd': keyState.d = true; break; // Fixed case from 's' to 'd'
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.key.toLowerCase()) {
            case 'w': keyState.w = false; break;
            case 'a': keyState.a = false; break;
            case 's': keyState.s = false; break;
            case 'd': keyState.d = false; break;
        }
    });

    // Exit VR on Escape key
    window.addEventListener('keydown', (event) => {
        if (event.code === 'Escape') {
            const session = renderer.xr.getSession();
            if (session) {
                session.end();
            }
        }
    });

    // Re-add Start Button Listener
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            startStream();
            startBtn.style.display = 'none';
            remoteVideo.play().catch(e => console.log("Autoplay prevented:", e));
        });
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    const delta = clock.getDelta();
    const moveSpeed = 3.0 * delta; // Meters per second

    if (renderer.xr.isPresenting) {
        // Simple WASD Movement relative to camera direction
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        // direction.y = 0; // Unlock vertical movement (Flying allowed)
        direction.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(camera.up, direction).normalize(); // Note: order matters for Left/Right, inverted here effectively or handled by +/-

        // Forward/Back
        if (keyState.w) userRig.position.addScaledVector(direction, moveSpeed);
        if (keyState.s) userRig.position.addScaledVector(direction, -moveSpeed);

        // Left/Right - Standard Right vector is (Up x Forward) ?? Actually usually Forward x Up = Right? 
        // ThreeJS standard: right = vector.crossVectors( camera.up, target ).normalize(); (if target is behind camera?)
        // Let's just trust common cross product: Forward x Up = Right.
        // But we calculated right = Up x Forward which is Left.
        // Let's test: Up(0,1,0) x Fwd(0,0,-1) = (-1, 0, 0) = Left. 
        // So Up x Fwd is Left.

        // Correcting logic:
        if (keyState.a) userRig.position.addScaledVector(right, moveSpeed); // Move "Left" (since 'right' var is actually left)
        if (keyState.d) userRig.position.addScaledVector(right, -moveSpeed); // Move "Right"
    }

    renderer.render(scene, camera);
}

init();
animate();

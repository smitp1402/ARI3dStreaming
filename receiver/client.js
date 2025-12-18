import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { VRButton } from 'https://unpkg.com/three@0.160.0/examples/jsm/webxr/VRButton.js';

// Use relative path so it works on localhost or IP or ngrok
const SIGNALING_URL = '';

// WebRTC Setup
// WebRTC Setup
let pc;

function createPeerConnection() {
    if (pc) {
        pc.close();
    }
    pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const remoteVideo = document.getElementById('remoteVideo');
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
    try {
        createPeerConnection();

        const response = await fetch(`/offer`);
        if (!response.ok) {
            console.log("No offer waiting...");
            return;
        }
        const offer = await response.json();

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
    }
}

// Three.js Setup
let camera, scene, renderer;
let videoTexture;

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    // WebXR RIG: User is always at 0,0,0. We move the world around them.
    camera.position.set(0, 0, 0);

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
    const geometryLeft = new THREE.PlaneGeometry(1.6, 0.9);
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
    const geometryRight = new THREE.PlaneGeometry(1.6, 0.9);
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
    container.appendChild(renderer.domElement);

    // Hide Mono mesh in VR, Show in Non-VR
    renderer.xr.addEventListener('sessionstart', () => {
        meshMono.visible = false;
    });
    renderer.xr.addEventListener('sessionend', () => {
        meshMono.visible = true;
    });

    document.body.appendChild(VRButton.createButton(renderer));

    window.addEventListener('resize', onWindowResize);

    document.getElementById('startBtn').addEventListener('click', () => {
        startStream();
        document.getElementById('startBtn').style.display = 'none';
        remoteVideo.play().catch(e => console.log("Autoplay prevented:", e));
    });
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
    renderer.render(scene, camera);
}

init();
animate();

import * as THREE from 'three';
import { VRManager } from './VRManager.js';

export class SceneManager {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.userRig = null;
        this.vrManager = null;
        this.meshMono = null;
        this.clock = new THREE.Clock();
    }

    init() {
        const container = document.createElement('div');
        document.body.appendChild(container);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x101010);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true;
        this.renderer.xr.setReferenceSpaceType('local');
        container.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);

        // User Rig for movement
        this.userRig = new THREE.Group();
        this.scene.add(this.userRig);
        this.userRig.add(this.camera);

        // Use VRManager to update rig/renderer
        this.vrManager = new VRManager(this.renderer, this.scene, this.camera, this.userRig);
        this.vrManager.init();

        // Geometry Setup
        this.setupVideoObjects();

        // Helpers
        const gridHelper = new THREE.GridHelper(20, 20, 0x404040, 0x404040);
        gridHelper.position.y = -1.5;
        this.scene.add(gridHelper);

        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Session Event Listeners
        this.renderer.xr.addEventListener('sessionstart', () => {
            if (this.meshMono) this.meshMono.visible = false;
            const session = this.renderer.xr.getSession();
            if (session && session.mode === 'immersive-ar') {
                this.scene.background = null;
            }
        });

        this.renderer.xr.addEventListener('sessionend', () => {
            setTimeout(() => {
                if (this.meshMono) this.meshMono.visible = true;
                this.scene.background = new THREE.Color(0x101010);

                // Reset Camera/Rig
                this.userRig.position.set(0, 0, 0);
                this.userRig.rotation.set(0, 0, 0);
                this.camera.position.set(0, 0, 0);
                this.camera.lookAt(0, 0, -3);
                this.camera.fov = 70;
                this.camera.updateProjectionMatrix();

                this.onWindowResize();
            }, 100);
        });
    }

    setupVideoObjects() {
        this.videoElement.crossOrigin = "anonymous";
        const videoTexture = new THREE.VideoTexture(this.videoElement);
        videoTexture.colorSpace = THREE.SRGBColorSpace;

        // Left Eye Mesh
        const geometryLeft = new THREE.PlaneGeometry(4.8, 2.7);
        const uvsLeft = geometryLeft.attributes.uv;
        for (let i = 0; i < uvsLeft.count; i++) {
            uvsLeft.setX(i, uvsLeft.getX(i) * 0.5);
        }
        const materialLeft = new THREE.MeshBasicMaterial({ map: videoTexture });
        const meshLeft = new THREE.Mesh(geometryLeft, materialLeft);
        meshLeft.position.z = -3;
        meshLeft.layers.set(1); // Left Eye Layer
        this.scene.add(meshLeft);

        // Right Eye Mesh
        const geometryRight = new THREE.PlaneGeometry(4.8, 2.7);
        const uvsRight = geometryRight.attributes.uv;
        for (let i = 0; i < uvsRight.count; i++) {
            uvsRight.setX(i, (uvsRight.getX(i) * 0.5) + 0.5);
        }
        const materialRight = new THREE.MeshBasicMaterial({ map: videoTexture });
        const meshRight = new THREE.Mesh(geometryRight, materialRight);
        meshRight.position.z = -3;
        meshRight.layers.set(2); // Right Eye Layer
        this.scene.add(meshRight);

        // Mono Mesh (Non-VR)
        const geometryMono = new THREE.PlaneGeometry(3.2, 0.9);
        const materialMono = new THREE.MeshBasicMaterial({ map: videoTexture });
        this.meshMono = new THREE.Mesh(geometryMono, materialMono);
        this.meshMono.position.z = -3;
        this.meshMono.layers.set(0); // Default Layer
        this.scene.add(this.meshMono);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    startRenderLoop(inputManagerCallback) {
        this.renderer.setAnimationLoop(() => {
            const delta = this.clock.getDelta();

            if (inputManagerCallback) {
                inputManagerCallback(delta, this.camera, this.userRig, this.renderer);
            }

            this.renderer.render(this.scene, this.camera);
        });
    }
}

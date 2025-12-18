import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

export class VRManager {
    constructor(renderer, scene, camera, userRig) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.userRig = userRig;
    }

    init() {
        // Wrappers for manual offsets
        this.controller1Wrapper = new THREE.Group();
        this.controller2Wrapper = new THREE.Group();

        this.userRig.add(this.controller1Wrapper);
        this.userRig.add(this.controller2Wrapper);

        // Controllers
        const controller1 = this.renderer.xr.getController(0);
        const controller2 = this.renderer.xr.getController(1);

        // Add pointing rays
        const rayGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        const rayLine = new THREE.Line(rayGeometry);
        rayLine.name = 'line';
        rayLine.scale.z = 5;

        controller1.add(rayLine.clone());
        controller2.add(rayLine.clone());

        this.controller1Wrapper.add(controller1);
        this.controller2Wrapper.add(controller2);

        // Highlight Boxes (Wireframe)
        const boxGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.2);
        const boxMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            visible: false
        });

        this.highlight1 = new THREE.Mesh(boxGeometry, boxMaterial.clone());
        this.highlight1.visible = false;
        this.controller1Wrapper.add(this.highlight1);

        this.highlight2 = new THREE.Mesh(boxGeometry, boxMaterial.clone());
        this.highlight2.visible = false;
        this.controller2Wrapper.add(this.highlight2);

        // Controller Models (Grips)
        const controllerModelFactory = new XRControllerModelFactory();

        const controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
        this.controller1Wrapper.add(controllerGrip1);

        const controllerGrip2 = this.renderer.xr.getControllerGrip(1);
        controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
        this.controller2Wrapper.add(controllerGrip2);

        // Check for XR support and add buttons
        if ('xr' in navigator) {
            navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
                if (supported) {
                    const vrButton = VRButton.createButton(this.renderer);
                    vrButton.style.left = 'calc(50% - 160px)';
                    vrButton.style.width = '150px';
                    document.body.appendChild(vrButton);
                }
            });

            navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
                if (supported) {
                    const arButton = ARButton.createButton(this.renderer);
                    arButton.style.left = 'calc(50% + 10px)';
                    arButton.style.width = '150px';
                    document.body.appendChild(arButton);
                }
            });
        } else {
            document.body.appendChild(VRButton.createButton(this.renderer));
        }
    }
}

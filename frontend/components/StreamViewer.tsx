"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";

const SIGNALING_URL = "ws://localhost:8000/ws/receiver";

function VRScene({ videoElement }: { videoElement: HTMLVideoElement }) {
    const { gl, scene, camera } = useThree();
    const textureRef = useRef<THREE.VideoTexture | null>(null);

    useEffect(() => {
        // Enable XR
        gl.xr.enabled = true;

        // Add VR Button to body
        const button = VRButton.createButton(gl);
        document.body.appendChild(button);

        // Create Video Texture
        const texture = new THREE.VideoTexture(videoElement);
        texture.colorSpace = THREE.SRGBColorSpace;
        textureRef.current = texture;

        return () => {
            document.body.removeChild(button);
            texture.dispose();
        };
    }, [gl, videoElement]);

    // Left Eye Geometry (UV 0.0 - 0.5)
    const LeftEye = () => {
        const geom = new THREE.PlaneGeometry(1.6, 0.9);
        const uvs = geom.attributes.uv;
        for (let i = 0; i < uvs.count; i++) {
            uvs.setX(i, uvs.getX(i) * 0.5);
        }
        return (
            <mesh position={[0, 0, -3]} layers={1}>
                <primitive object={geom} attach="geometry" />
                <meshBasicMaterial map={textureRef.current} />
            </mesh>
        );
    };

    // Right Eye Geometry (UV 0.5 - 1.0)
    const RightEye = () => {
        const geom = new THREE.PlaneGeometry(1.6, 0.9);
        const uvs = geom.attributes.uv;
        for (let i = 0; i < uvs.count; i++) {
            uvs.setX(i, (uvs.getX(i) * 0.5) + 0.5);
        }
        return (
            <mesh position={[0, 0, -3]} layers={2}>
                <primitive object={geom} attach="geometry" />
                <meshBasicMaterial map={textureRef.current} />
            </mesh>
        );
    };

    // Mono View (Layer 0 - for non-VR)
    const MonoEye = () => {
        // Just show full video or left eye? Let's show full video for debug
        return (
            <mesh position={[0, 0, -3]} layers={0}>
                <planeGeometry args={[3.2, 0.9]} />
                <meshBasicMaterial map={textureRef.current} />
            </mesh>
        )
    }

    // Hook to hide Mono view in VR
    useEffect(() => {
        const sessionStart = () => {
            // We can handle visibility logic here if needed, but layers usually handle it.
            // Camera usually has layer 0 enabled by default.
            // In XR, left camera has layer 1, right has layer 2.
            // So they won't see layer 0 unless enabled.
            // We usually want Layer 0 hidden in VR if it overlaps? 
            // Actually, if we put Mono on Layer 0, and Left/Right on 1/2.
            // VR Cameras (Left/Right) default to connection mask 1 and 2?
            // Let's rely on standard current behavior.
        }
        gl.xr.addEventListener('sessionstart', sessionStart)
        return () => gl.xr.removeEventListener('sessionstart', sessionStart)
    }, [gl])

    return (
        <>
            {textureRef.current && <LeftEye />}
            {textureRef.current && <RightEye />}
            {textureRef.current && <MonoEye />}
        </>
    );
}

export default function StreamViewer() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoReady, setVideoReady] = useState(false);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Initialize WebRTC
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;

        pc.ontrack = (event) => {
            console.log("Track received");
            if (video.srcObject !== event.streams[0]) {
                video.srcObject = event.streams[0];
                setVideoReady(true);
            }
        };

        // WebSocket Signaling
        const ws = new WebSocket(SIGNALING_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("Connected to Signaling Server");
        };

        ws.onmessage = async (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === "offer") {
                console.log("Received Offer");
                await pc.setRemoteDescription(new RTCSessionDescription(msg));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify(pc.localDescription));
            } else if (msg.type === "candidate") {
                if (msg.candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                }
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
            }
        };

        return () => {
            pc.close();
            ws.close();
        };
    }, []);

    return (
        <div className="w-full h-screen bg-black">
            {/* Hidden Video Element */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                crossOrigin="anonymous"
                style={{ display: "none" }}
            />

            {!videoReady && (
                <div className="absolute inset-0 flex items-center justify-center text-white z-10 pointer-events-none">
                    <div className="bg-gray-900 p-4 rounded bg-opacity-80">
                        <p>Waiting for Stream...</p>
                    </div>
                </div>
            )}

            {videoReady && (
                <Canvas>
                    <color attach="background" args={["#101010"]} />
                    <VRScene videoElement={videoRef.current!} />
                </Canvas>
            )}
        </div>
    );
}

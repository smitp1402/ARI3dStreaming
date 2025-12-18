# 3D Streaming Software

This project implements a WebRTC-based 3D video streaming system. It consists of a reliable Python-based publisher, a signaling server, and a web-based receiver capable of stereoscopic rendering for VR/AR.

## Prerequisites
- **Python 3.7+**
- **FFmpeg** (Required for `aiortc` / `av`)
- A Side-by-Side (SBS) 3D video file.

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/smitp1402/ARI3dStreaming.git
   cd ARI3dStreaming
   ```

2. **Install Python dependencies:**
   ```bash
   pip install aiohttp aiortc av
   ```

## Running the System

You need to run the signaling server and the publisher simultaneously.

### 1. Signaling Server
This server handles the WebRTC signaling (SDP exchange) and also serves the static web receiver files.

```bash
python signaling/server.py
```
*Server runs at: [http://localhost:8080](http://localhost:8080)*

### 2. Publisher
This component reads the video file and streams it to the receiver via WebRTC.

```bash
# Default (looks for publisher/sbs_video.mp4)
python publisher/publisher.py

# OR specify a custom video file
python publisher/publisher.py --video publisher/test.mp4
```

### 3. Receiver
1. Open your web browser (Chrome/Edge recommended for WebXR).
2. Navigate to [http://localhost:8080](http://localhost:8080).
3. Click **Start Stream** to begin.

---

## Simulation Controls (Keyboard)
When the stream is running, you can use the keyboard to simulate VR movement and controller inputs.

| Key | Action |
| :--- | :--- |
| **W / A / S / D** | Move the Player (User Rig) |
| **Q** | Select **Left** Controller |
| **E** | Select **Right** Controller |
| **B** | Select **Both** Controllers |
| **Arrow Keys** | Move Selected Controller(s) (Position Offset) |
| **Esc** | Exit Simulation Mode |

## Features
- **WebRTC Streaming**: Low latency video streaming using `aiortc`.
- **Stereoscopic Rendering**: Renders Left/Right eye views for VR headsets.
- **WebXR Support**: Compatible with VR/AR devices.
- **Simulation Mode**: Test VR interactions on a desktop using keyboard controls.

## Development Tools (WebXR Simulator)

To test VR/AR features without a physical headset, we recommend using the **WebXR API Emulator** extension.

**Mozilla Firefox:**
1. Install the extension from [Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/webxr-api-emulator/).
2. Open the "WebXR" tab in the developer tools (F12) to simulate a headset and controllers.

**Google Chrome:**
- Also available on the [Chrome Web Store](https://chrome.google.com/webstore/detail/webxr-api-emulator/mjddjgeghkdijejnciaefnkjmkafnnje).

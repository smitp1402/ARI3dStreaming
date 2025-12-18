# 3D Streaming Software

## Prerequisites
- Python 3.7+
- A side-by-sde (SBS) 3D video file (e.g., `sbs_video.mp4`)

## Installation
Install the required Python packages:
```bash
pip install aiohttp aiortc
```
*(Note: `aiortc` requires PyAV which may need ffmpeg installed on your system)*

## Running the System

### 1. Signaling Server
Start the signaling server which acts as the coordinator and serves the web receiver.
```bash
python signaling/server.py
```
*Runs on http://localhost:8080*

### 2. Publisher
Start the publisher to stream the video. 
**Important**: You must have a video file.
- Place a file named `sbs_video.mp4` in the `publisher/` directory, OR
- Run with the `--video` argument:
```bash
python publisher/publisher.py --video /path/to/your/video.mp4
```

### 3. Receiver
Open your web browser and navigate to:
[http://localhost:8080](http://localhost:8080)

Click **"Start VR Stream"** to begin receiving the stream.

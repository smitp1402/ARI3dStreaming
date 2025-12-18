import argparse
import asyncio
import logging
import os
import sys
import time
import uuid

import aiohttp
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaPlayer

ROOT = os.path.dirname(__file__)
VIDEO_PATH = os.path.join(ROOT, "sbs_video.mp4") # Default video path

# Signaling Server URL
SIGNALING_URL = "http://localhost:8080"

async def run(pc, player):
    # Create an offer
    print("Creating offer...")
    try:
        if player and player.video:
             pc.addTrack(player.video)
        else:
             print("Error: No video track found.")
             return

        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        # Send offer to signaling server
        async with aiohttp.ClientSession() as session:
            payload = {
                "sdp": pc.localDescription.sdp,
                "type": pc.localDescription.type
            }
            async with session.post(f"{SIGNALING_URL}/offer", json=payload) as resp:
                if resp.status != 200:
                    print(f"Failed to send offer: {resp.status}")
                    return
                print("Offer sent to signaling server.")

            # Poll for answer
            print("Waiting for answer...")
            while True:
                async with session.get(f"{SIGNALING_URL}/answer") as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        answer = RTCSessionDescription(sdp=data["sdp"], type=data["type"])
                        await pc.setRemoteDescription(answer)
                        print("Answer received and set. Connection establishing...")
                        break
                    elif resp.status == 404:
                         # Still waiting
                         await asyncio.sleep(1)
                    else:
                        print(f"Error getting answer: {resp.status}")
                        return

        # Keep alive
        print("Streaming... Press Ctrl+C to stop.")
        while True:
            await asyncio.sleep(10)

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

def main():
    parser = argparse.ArgumentParser(description="WebRTC Publisher")
    parser.add_argument("--video", default=VIDEO_PATH, help="Path to video file")
    args = parser.parse_args()

    if not os.path.exists(args.video):
        print(f"Error: Video file not found at {args.video}")
        print("Please provide a valid 'sbs_video.mp4' file or specify with --video")
        return

    logging.basicConfig(level=logging.INFO)

    # create media source
    player = MediaPlayer(args.video, loop=True)

    # create peer connection
    pc = RTCPeerConnection()

    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(run(pc, player))
    except KeyboardInterrupt:
        pass
    finally:
        loop.run_until_complete(pc.close())

if __name__ == "__main__":
    main()

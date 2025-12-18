import argparse
import asyncio
import logging
import os
import sys
import time
import uuid

import aiohttp
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
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
            current_answer = None
            while True:
                async with session.get(f"{SIGNALING_URL}/answer") as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        current_answer = data
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
                await asyncio.sleep(1) # Check faster
                
                # Check for connection health
                if pc.connectionState in ["failed", "closed"] or pc.iceConnectionState in ["failed", "closed", "disconnected"]:
                    print(f"Connection state: {pc.connectionState}, ICE state: {pc.iceConnectionState}. Resetting...")
                    break
                
                # Check for new answer (Client likely refreshed)
                try:
                    async with session.get(f"{SIGNALING_URL}/answer") as resp:
                        if resp.status == 200:
                            new_data = await resp.json()
                            if new_data != current_answer:
                                print("New answer detected (client refreshed?). Resetting...")
                                break
                except Exception as e:
                    print(f"Error checking answer status: {e}")

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

    # create event loop
    loop = asyncio.get_event_loop()

    # create peer connection
    while True:
        print("Waiting for new connection...")
        
        # Create fresh media source for each connection
        player = MediaPlayer(args.video, loop=True)
        
        try:
            pc = RTCPeerConnection(
                configuration=RTCConfiguration(
                    iceServers=[RTCIceServer(urls="stun:stun.l.google.com:19302")]
                )
            )
            # Reset player to start or keep playing? simpler to just attach existing player
            # But MediaPlayer might need reset if it finished? 
            # For now, let's just reuse the player instance but we might need to seek 0 if we want restart.
            
            loop.run_until_complete(run(pc, player))
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Connection ended/failed: {e}")
            # Clean up old PC
            loop.run_until_complete(pc.close())
        finally:
             loop.run_until_complete(pc.close())

if __name__ == "__main__":
    main()

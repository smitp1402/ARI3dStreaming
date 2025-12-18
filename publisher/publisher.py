import argparse
import asyncio
import json
import logging
import os
import aiohttp
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer, RTCIceCandidate
from aiortc.contrib.media import MediaPlayer

ROOT = os.path.dirname(__file__)
VIDEO_PATH = os.path.join(ROOT, "sbs_video.mp4") # Default video path
SIGNALING_URL = "ws://localhost:8000/ws/publisher"

logger = logging.getLogger("pc")

def create_pc():
    return RTCPeerConnection(
        configuration=RTCConfiguration(
            iceServers=[RTCIceServer(urls="stun:stun.l.google.com:19302")]
        )
    )

async def main_loop():
    parser = argparse.ArgumentParser(description="WebRTC Publisher")
    parser.add_argument("--video", default=VIDEO_PATH, help="Path to video file")
    args = parser.parse_args()

    if not os.path.exists(args.video):
        print(f"Error: Video file not found at {args.video}")
        return

    logging.basicConfig(level=logging.INFO)
    
    # Create MediaPlayer once or per connection? 
    # For looping video, one global player is fine if added as track.
    player = MediaPlayer(args.video, loop=True)
    
    # We maintain a reference to the active PC
    pc = None

    async with aiohttp.ClientSession() as session:
        try:
            async with session.ws_connect(SIGNALING_URL) as ws:
                print(f"Connected to Signaling Server at {SIGNALING_URL}")
                
                # Initial setup - we are ready
                # We could send a "hello" if needed, but server knows us by URL path
                
                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        data = json.loads(msg.data)
                        msg_type = data.get("type")
                        
                        if msg_type == "receiver_connected":
                            print("------------------------------------------------")
                            print(">> New Receiver Connected! Starting Stream Negotiation...")
                            
                            # Clean up old connection if exists
                            if pc:
                                print(">> Closing previous connection...")
                                await pc.close()
                                pc = None
                            
                            # Create new PeerConnection
                            pc = create_pc()
                            
                            # Add Video Track
                            if player.video:
                                pc.addTrack(player.video)
                            else:
                                print("Error: No video track available!")
                            
                            # Create and set Offer
                            offer = await pc.createOffer()
                            await pc.setLocalDescription(offer)
                            
                            # Wait for ICE gathering to complete (simple way for scripts)
                            print(">> Waiting for ICE gathering...")
                            await asyncio.sleep(2)
                            
                            # Send Offer
                            print(">> Sending Offer to Signaling Server...")
                            await ws.send_json({
                                "type": "offer", 
                                "sdp": pc.localDescription.sdp, 
                                "type": pc.localDescription.type
                            })
                            
                        elif msg_type == "answer":
                            print(">> Received Answer from Receiver.")
                            if pc:
                                try:
                                    answer = RTCSessionDescription(sdp=data["sdp"], type=data["type"])
                                    await pc.setRemoteDescription(answer)
                                    print(">> Connection Established! Streaming...")
                                except Exception as e:
                                    print(f"Error setting remote description: {e}")
                            else:
                                print(">> Warning: Received answer but no PC active.")
                                
                        elif msg_type == "candidate":
                            # Handle ICE candidate if needed
                            # print(f">> Received Candidate: {data}")
                            if pc and data.get("candidate"):
                                c = data["candidate"]
                                try:
                                    candidate = RTCIceCandidate(
                                        component=c["component"],
                                        foundation=c["foundation"],
                                        ip=c["ip"],
                                        port=c["port"],
                                        priority=c["priority"],
                                        protocol=c["protocol"],
                                        type=c["type"],
                                        sdpMid=c["sdpMid"],
                                        sdpMLineIndex=c["sdpMLineIndex"],
                                        relatedAddress=c.get("relatedAddress"),
                                        relatedPort=c.get("relatedPort")
                                    )
                                    await pc.addIceCandidate(candidate)
                                except Exception as e:
                                    # Ignore errors if candidate is invalid or state is wrong
                                    pass

                        elif msg_type == "receiver_disconnected":
                            print(">> Receiver Disconnected.")
                            if pc:
                                await pc.close()
                                pc = None
                                print(">> Connection Closed and Reset.")

                    elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                        print("!! WebSocket connection closed.")
                        break
        except Exception as e:
            print(f"Connection Error: {e}")
            print("Is the backend running? (fastapi dev backend/main.py)")
        finally:
            if pc:
                await pc.close()

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(main_loop())
    except KeyboardInterrupt:
        pass
    finally:
        loop.close()

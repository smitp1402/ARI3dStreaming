import argparse
import asyncio
import json
import logging
import os
import ssl
import uuid

from aiohttp import web

ROOT = os.path.dirname(__file__)
RECEIVER_DIR = os.path.join(os.path.dirname(ROOT), "receiver")

logger = logging.getLogger("pc")
pcs = set()

# Global state for simple signaling (1 publisher, 1 receiver)
offer_sdp = None
answer_sdp = None

async def post_offer(request):
    global offer_sdp, answer_sdp
    params = await request.json()
    offer_sdp = params
    answer_sdp = None # Reset answer when new offer comes
    print("Received Offer")
    return web.json_response({"status": "ok"})

async def get_offer(request):
    global offer_sdp
    if offer_sdp:
        return web.json_response(offer_sdp)
    return web.Response(status=404) # Not found

async def post_answer(request):
    global answer_sdp
    params = await request.json()
    answer_sdp = params
    print("Received Answer")
    return web.json_response({"status": "ok"})

async def get_answer(request):
    global answer_sdp
    if answer_sdp:
        return web.json_response(answer_sdp)
    return web.Response(status=404)

async def index(request):
    return web.FileResponse(os.path.join(RECEIVER_DIR, "index.html"))

async def receiver_static(request):
    path = request.match_info['path']
    return web.FileResponse(os.path.join(RECEIVER_DIR, path))

def main():
    parser = argparse.ArgumentParser(description="WebRTC Signaling Server")
    parser.add_argument("--port", type=int, default=8080, help="Port for HTTP server (default: 8080)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    app = web.Application()
    
    # API for signaling
    app.router.add_post("/offer", post_offer)
    app.router.add_get("/offer", get_offer)
    app.router.add_post("/answer", post_answer)
    app.router.add_get("/answer", get_answer)

    # Static files for Receiver
    app.router.add_get("/", index)
    app.router.add_get("/{path:.*}", receiver_static)

    print("======== Running on http://localhost:{} ========".format(args.port))
    web.run_app(app, access_log=None, port=args.port, print=None)

if __name__ == "__main__":
    main()

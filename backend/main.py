from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("signaling")

app = FastAPI()

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.publisher: WebSocket | None = None
        self.receivers: list[WebSocket] = []

    async def connect_publisher(self, websocket: WebSocket):
        await websocket.accept()
        self.publisher = websocket
        logger.info("Publisher connected")
        # Notify publisher about existing receivers (if any, though usually pub starts first)
        # But actually, publisher needs to know when a NEW receiver joins.

    async def connect_receiver(self, websocket: WebSocket):
        await websocket.accept()
        self.receivers.append(websocket)
        logger.info("Receiver connected")
        # Notify publisher that a receiver has joined
        if self.publisher:
            await self.publisher.send_text(json.dumps({"type": "receiver_connected"}))
        else:
            logger.warning("Receiver connected but no publisher available")

    def disconnect_publisher(self):
        self.publisher = None
        logger.info("Publisher disconnected")

    def disconnect_receiver(self, websocket: WebSocket):
        if websocket in self.receivers:
            self.receivers.remove(websocket)
        logger.info("Receiver disconnected")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.receivers:
            await connection.send_text(message)
            
    async def forward_to_publisher(self, data: dict):
        if self.publisher:
            await self.publisher.send_text(json.dumps(data))
            
    async def forward_to_receiver(self, data: dict, sender_socket: WebSocket):
        # In a 1:1 scenario this is tricky if we have multiple receivers. 
        # For this assignment, let's assume 1 active receiver at a time or broadcast to all?
        # Typically WebRTC is 1:1. If we have multiple receivers, the publisher needs to create multiple PCs.
        # But for this simple assignment, let's just broadcast the publisher's offer/answer to the specific receiver?
        # Actually, usually the "Receiver" (client) sends an OFFER or waits for an OFFER?
        # In our old code: Publisher sent OFFER. Receiver GOT offer.
        # Let's stick to: Publisher sends OFFER via WS. We forward to ALL receivers (or the new one).
        pass

manager = ConnectionManager()

@app.websocket("/ws/{client_type}")
async def websocket_endpoint(websocket: WebSocket, client_type: str):
    if client_type == "publisher":
        await manager.connect_publisher(websocket)
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Publisher sending an OFFER or ICE Candidate
                if message.get("type") == "offer":
                    # Broadcast offer to all connected receivers
                    # In a real app, we'd target a specific session.
                    logger.info("Broadcasting OFFER to receivers")
                    for receiver in manager.receivers:
                        await receiver.send_text(data)
                
                elif message.get("type") == "candidate":
                    # Forward candidate to receivers
                    for receiver in manager.receivers:
                        await receiver.send_text(data)

        except WebSocketDisconnect:
            manager.disconnect_publisher()
            
    elif client_type == "receiver":
        await manager.connect_receiver(websocket)
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Receiver sending an ANSWER or ICE Candidate
                if message.get("type") == "answer":
                    logger.info("Forwarding ANSWER to publisher")
                    await manager.forward_to_publisher(message)
                    
                elif message.get("type") == "candidate":
                     await manager.forward_to_publisher(message)

        except WebSocketDisconnect:
            manager.disconnect_receiver(websocket)
            # Notify publisher so it can reset/wait for new connection
            if manager.publisher:
                await manager.publisher.send_text(json.dumps({"type": "receiver_disconnected"}))

# Run with: fastapi dev backend/main.py

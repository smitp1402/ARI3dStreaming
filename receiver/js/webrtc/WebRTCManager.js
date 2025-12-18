export class WebRTCManager {
    constructor(videoElement) {
        this.remoteVideo = videoElement;
        this.pc = null;
        this.lastConsumedOfferSdp = null;
    }

    createPeerConnection() {
        if (this.pc) {
            this.pc.close();
        }
        this.pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.pc.ontrack = (event) => {
            console.log("Stream received!");
            if (this.remoteVideo.srcObject !== event.streams[0]) {
                this.remoteVideo.srcObject = event.streams[0];
                this.remoteVideo.play().catch(e => console.log("Autoplay error:", e));
            }
            this.startStatsMonitoring();
        };

        this.pc.oniceconnectionstatechange = () => {
            console.log("ICE State:", this.pc.iceConnectionState);
            if (this.pc.iceConnectionState === "failed" || this.pc.iceConnectionState === "disconnected") {
                console.log("Connection failed/disconnected. Retrying...");
                this.stopStatsMonitoring();
                setTimeout(() => {
                    console.log("Retrying connection...");
                    this.startStream();
                }, 1000);
            }
        };
    }

    startStatsMonitoring() {
        this.stopStatsMonitoring(); // Clear existing
        const rttEl = document.getElementById('rttValue');
        const resEl = document.getElementById('resValue');
        const statsBox = document.getElementById('stats');

        if (statsBox) statsBox.style.display = 'block';

        this.statsInterval = setInterval(async () => {
            if (!this.pc) return;

            // Update Resolution from Video Element
            if (this.remoteVideo.videoWidth) {
                if (resEl) resEl.innerText = `${this.remoteVideo.videoWidth}x${this.remoteVideo.videoHeight}`;
            }

            // Get WebRTC Stats
            try {
                const stats = await this.pc.getStats();
                let activeCandidatePair = null;
                let remoteInbound = null;

                stats.forEach(report => {
                    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                        activeCandidatePair = report;
                    }
                });

                if (activeCandidatePair && rttEl) {
                    const rtt = activeCandidatePair.currentRoundTripTime
                        ? (activeCandidatePair.currentRoundTripTime * 1000).toFixed(1)
                        : (activeCandidatePair.roundTripTime
                            ? (activeCandidatePair.roundTripTime * 1000).toFixed(1)
                            : '-');
                    rttEl.innerText = rtt;
                }
            } catch (e) {
                console.warn("Stats error:", e);
            }
        }, 1000);
    }

    stopStatsMonitoring() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
        const statsBox = document.getElementById('stats');
        if (statsBox) statsBox.style.display = 'none';
    }

    async startStream() {
        try {
            console.log("Looking for offer...");
            let offer = null;

            while (true) {
                const response = await fetch(`/offer`);
                if (response.ok) {
                    const data = await response.json();
                    if (this.lastConsumedOfferSdp && data.sdp === this.lastConsumedOfferSdp) {
                        console.log("Offer is stale (same as last failed attempt). Waiting for new offer...");
                        await new Promise(r => setTimeout(r, 1000));
                        continue;
                    }
                    offer = data;
                    break;
                } else {
                    console.log("No offer waiting. Retrying in 1s...");
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            console.log("Found fresh offer. Connecting...");
            this.lastConsumedOfferSdp = offer.sdp;

            this.createPeerConnection();

            await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);

            await fetch(`/answer`, {
                method: 'POST',
                body: JSON.stringify(this.pc.localDescription),
                headers: { 'Content-Type': 'application/json' }
            });

            console.log("Answer sent!");

        } catch (e) {
            console.error("Error starting stream:", e);
            setTimeout(() => this.startStream(), 2000);
        }
    }
}

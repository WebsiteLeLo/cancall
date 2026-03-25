import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  deleteDoc,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

const servers: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

export type CallMode = "video" | "audio";

export class WebRTCCall {
  pc: RTCPeerConnection;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream;
  roomId: string | null = null;
  mode: CallMode;

  onPeerHangUp: (() => void) | null = null;

  private unsubs: Unsubscribe[] = [];
  private remoteDescSet = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private hungUp = false;
  private hasConnected = false;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(mode: CallMode = "video") {
    this.mode = mode;
    this.pc = new RTCPeerConnection(servers);
    this.remoteStream = new MediaStream();

    this.pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream.addTrack(track);
      });
    };
  }

  private async safeAddCandidate(data: RTCIceCandidateInit) {
    if (this.remoteDescSet) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(data));
      } catch (_) {}
    } else {
      this.pendingCandidates.push(data);
    }
  }

  private async flushPendingCandidates() {
    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const c of candidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (_) {}
    }
  }

  private firePeerHangUp() {
    if (!this.hungUp) {
      this.onPeerHangUp?.();
    }
  }

  markConnected() {
    this.hasConnected = true;
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  handleDisconnect() {
    if (!this.hasConnected) return;
    if (this.disconnectTimer) return;
    this.disconnectTimer = setTimeout(() => {
      this.firePeerHangUp();
    }, 15000);
  }

  handleFailed() {
    this.firePeerHangUp();
  }

  async getLocalMedia() {
    const constraints =
      this.mode === "video"
        ? { video: true, audio: true }
        : { video: false, audio: true };
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.localStream.getTracks().forEach((track) => {
      this.pc.addTrack(track, this.localStream!);
    });
    return this.localStream;
  }

  async createRoom(): Promise<string> {
    const roomRef = doc(collection(db, "rooms"));
    this.roomId = roomRef.id;

    const offerCandidatesRef = collection(roomRef, "offerCandidates");
    const answerCandidatesRef = collection(roomRef, "answerCandidates");

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(offerCandidatesRef, event.candidate.toJSON()).catch(() => {});
      }
    };

    const offerDescription = await this.pc.createOffer();
    await this.pc.setLocalDescription(offerDescription);

    await setDoc(roomRef, {
      offer: {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
        mode: this.mode,
      },
    });

    const unsub = onSnapshot(roomRef, async (snapshot) => {
      if (!snapshot.exists()) {
        if (this.hasConnected && !this.hungUp) {
          this.firePeerHangUp();
        }
        return;
      }
      const data = snapshot.data();
      if (!this.remoteDescSet && data?.answer) {
        this.remoteDescSet = true;
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await this.flushPendingCandidates();
        } catch (_) {}
      }
    });
    this.unsubs.push(unsub);

    const unsub2 = onSnapshot(answerCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          this.safeAddCandidate(change.doc.data() as RTCIceCandidateInit);
        }
      });
    });
    this.unsubs.push(unsub2);

    return this.roomId;
  }

  async joinRoom(roomId: string) {
    this.roomId = roomId;
    const roomRef = doc(db, "rooms", roomId);
    const roomSnapshot = await getDoc(roomRef);

    if (!roomSnapshot.exists()) {
      throw new Error("Room not found. Check the room ID and try again.");
    }

    const offerCandidatesRef = collection(roomRef, "offerCandidates");
    const answerCandidatesRef = collection(roomRef, "answerCandidates");

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(answerCandidatesRef, event.candidate.toJSON()).catch(() => {});
      }
    };

    const roomData = roomSnapshot.data();
    await this.pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));
    this.remoteDescSet = true;

    const answerDescription = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answerDescription);

    await setDoc(roomRef, {
      ...roomData,
      answer: {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      },
    });
    await this.flushPendingCandidates();

    const unsub = onSnapshot(offerCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          this.safeAddCandidate(change.doc.data() as RTCIceCandidateInit);
        }
      });
    });
    this.unsubs.push(unsub);

    const unsub2 = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists() && this.hasConnected && !this.hungUp) {
        this.firePeerHangUp();
      }
    });
    this.unsubs.push(unsub2);
  }

  toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled;
    }
    return false;
  }

  toggleCamera(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled;
    }
    return false;
  }

  async hangUp() {
    this.hungUp = true;
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.unsubs.forEach((unsub) => unsub());
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.pc.close();
    if (this.roomId) {
      try {
        await deleteDoc(doc(db, "rooms", this.roomId));
      } catch (_) {}
    }
  }
}

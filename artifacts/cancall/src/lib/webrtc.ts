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
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
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
  private unsubs: Unsubscribe[] = [];

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
        addDoc(offerCandidatesRef, event.candidate.toJSON());
      }
    };

    const offerDescription = await this.pc.createOffer();
    await this.pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
      mode: this.mode,
    };

    await setDoc(roomRef, { offer });

    const unsub = onSnapshot(roomRef, (snapshot) => {
      const data = snapshot.data();
      if (!this.pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        this.pc.setRemoteDescription(answerDescription);
      }
    });
    this.unsubs.push(unsub);

    const unsub2 = onSnapshot(answerCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          this.pc.addIceCandidate(candidate);
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
        addDoc(answerCandidatesRef, event.candidate.toJSON());
      }
    };

    const roomData = roomSnapshot.data();
    const offerDescription = roomData.offer;
    await this.pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await setDoc(roomRef, { ...roomData, answer });

    const unsub = onSnapshot(offerCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          this.pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    this.unsubs.push(unsub);
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

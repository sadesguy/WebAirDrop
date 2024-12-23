export interface Device {
  id: string;
  name: string;
  connected: boolean;
}

export interface FileTransferRequest {
  fileName: string;
  fileSize: number;
  sourceDevice: string;
  sessionId?: string;
  lastChunkIndex?: number;
}

export interface WebRTCMessage {
  type:
    | "device-discovered"
    | "device-disconnected"
    | "offer"
    | "answer"
    | "ice-candidate"
    | "file-request"
    | "file-accepted"
    | "file-rejected"
    | "file-request-sent"
    | "error"
    | "ping"
    | "pong";
  device?: Device;
  deviceId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidate;
  fileName?: string;
  fileSize?: number;
  sourceDevice?: string;
  targetDevice?: string;
  message?: string;
  sessionId?: string;
  lastChunkIndex?: number;
}

export interface SystemStatus {
  connected: boolean;
  activeConnections: number;
  lastPingTime?: number;
}

export interface TransferLog {
  timestamp: number;
  fileName: string;
  fileSize: number;
  type: "send" | "receive";
  success: boolean;
  peerName: string;
}

export interface ErrorLog {
  timestamp: number;
  message: string;
  code?: string;
  details?: unknown;
}

export interface TransferSession {
  id: string;
  fileName: string;
  fileSize: number;
  targetDevice: string;
  startTime: number;
  lastChunkIndex: number;
  completed: boolean;
  totalChunks: number;
  checksum: string;
}

export interface SpeedData {
  time: number;
  speed: number;
}

export interface TransferState {
  id: string;
  fileName: string;
  fileSize: number;
  sourceDevice?: string;
  targetDevice?: string;
  startTime: number;
  lastChunkIndex: number;
  lastUpdateTime: number;
  completed: boolean;
  chunks: Record<number, boolean>;
  progress: number;
  resumable: boolean;
}

export interface TransferSessionStorage {
  [sessionId: string]: {
    state: TransferState;
    chunks?: ArrayBuffer[];
    lastUpdate: number;
  };
}

import type {
  Device,
  FileTransferRequest,
  WebRTCMessage,
  TransferLog,
  ErrorLog,
  SystemStatus,
  TransferSession,
} from "./types";

interface TransferState {
  id: string;
  fileName: string;
  fileSize: number;
  targetDevice: string;
  startTime: number;
  lastChunkIndex: number;
  lastUpdateTime: number;
  completed: boolean;
  chunks: { [index: number]: boolean };
  progress: number;
  resumable: boolean;
}

interface TransferSessionStorage {
  [sessionId: string]: {
    state: TransferState;
    chunks: ArrayBuffer[];
    lastUpdate: number;
  };
}

// Update constructor to use config chunk size
export class WebRTCManager {
  private static readonly STORAGE_KEY = "webdrop_transfers";
  private static readonly MAX_STORAGE_AGE = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly CHUNK_TIMEOUT = 30 * 1000; // 30 seconds
  private static readonly MIN_CHUNK_SIZE = 16384; // 16KB minimum

  private chunkSize: number;

  constructor(ws: WebSocket, config?: { chunkSize?: number }) {
    this.ws = ws;

    // Get chunk size from environment and convert to bytes
    const envChunkSize = import.meta.env.VITE_TRANSFER_CHUNK_SIZE;
    const chunkSizeBytes = envChunkSize
      ? parseInt(envChunkSize) * 1024
      : undefined;

    // Use env value or fallback to config or default
    this.chunkSize = Math.max(
      WebRTCManager.MIN_CHUNK_SIZE,
      chunkSizeBytes || config?.chunkSize || 1048576,
    );

    console.log(
      `Initialized WebRTCManager with chunk size: ${this.chunkSize} bytes (from ${envChunkSize}KB)`,
    );

    this.setupWebSocket();
    this.startPingInterval();
    this.loadTransferState();
    this.cleanupOldTransfers();
  }

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private ws: WebSocket;
  private deviceListeners: ((device: Device) => void)[] = [];
  private disconnectListeners: ((deviceId: string) => void)[] = [];
  private progressListeners: ((progress: number) => void)[] = [];
  private fileRequestListeners: ((request: FileTransferRequest) => void)[] = [];
  private statusListeners: ((status: SystemStatus) => void)[] = [];
  private errorListeners: ((error: ErrorLog) => void)[] = [];
  private transferLogListeners: ((log: TransferLog) => void)[] = [];
  private activeTransferListeners: ((transfers: TransferSession[]) => void)[] =
    [];
  private pendingTransfers: Map<
    string,
    { accept: () => void; reject: () => void }
  > = new Map();
  private receivedChunks: Map<string, ArrayBuffer[]> = new Map();
  private expectedFileSize: number = 0;
  private receivedSize: number = 0;
  private currentFileName: string = "";
  private transferLogs: TransferLog[] = [];
  private errorLogs: ErrorLog[] = [];
  private connectedPeers: Set<string> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private incomingFileRequest: FileTransferRequest | null = null;
  private activeTransferSession: TransferSession | null = null;
  private lastReceivedChunkIndex: number = -1;

  private loadTransferState() {
    try {
      const savedState = localStorage.getItem(WebRTCManager.STORAGE_KEY);
      if (savedState) {
        const transfers = JSON.parse(savedState) as TransferSessionStorage;

        // Find any valid incomplete transfers
        Object.entries(transfers).forEach(([sessionId, data]) => {
          const { state, chunks, lastUpdate } = data;

          // Skip if transfer is too old
          if (Date.now() - lastUpdate > WebRTCManager.MAX_STORAGE_AGE) {
            return;
          }

          if (!state.completed && state.resumable) {
            // Restore transfer state
            this.activeTransferSession = {
              id: sessionId,
              fileName: state.fileName,
              fileSize: state.fileSize,
              targetDevice: state.targetDevice || "",
              startTime: state.startTime,
              lastChunkIndex: state.lastChunkIndex,
              completed: false,
              totalChunks: Math.ceil(state.fileSize / this.chunkSize),
              checksum: "",
            };

            // Restore received chunks if available
            if (chunks) {
              this.receivedChunks.set(state.fileName, chunks);
              this.receivedSize = chunks.reduce(
                (size, chunk) => size + (chunk?.byteLength || 0),
                0,
              );
              this.expectedFileSize = state.fileSize;
              this.currentFileName = state.fileName;
              this.lastReceivedChunkIndex = state.lastChunkIndex;
            }
          }
        });
      }
    } catch (error) {
      console.error("Error loading transfer state:", error);
      this.cleanupOldTransfers();
    }
  }

  private saveTransferState() {
    try {
      const currentState = localStorage.getItem(WebRTCManager.STORAGE_KEY);
      const transfers: TransferSessionStorage = currentState
        ? JSON.parse(currentState)
        : {};

      if (this.activeTransferSession) {
        const state: TransferState = {
          id: this.activeTransferSession.id,
          fileName: this.activeTransferSession.fileName,
          fileSize: this.activeTransferSession.fileSize,
          targetDevice: this.activeTransferSession.targetDevice,
          startTime: this.activeTransferSession.startTime,
          lastChunkIndex: this.lastReceivedChunkIndex,
          lastUpdateTime: Date.now(),
          completed: this.activeTransferSession.completed,
          chunks: {},
          progress: this.receivedSize / this.expectedFileSize,
          resumable: true,
        };

        // Save chunk status
        const chunks = this.receivedChunks.get(this.currentFileName);
        if (chunks) {
          chunks.forEach((chunk, index) => {
            if (chunk) {
              state.chunks[index] = true;
            }
          });
        }

        transfers[this.activeTransferSession.id] = {
          state,
          chunks: Array.from(
            this.receivedChunks.get(this.currentFileName) || [],
          ),
          lastUpdate: Date.now(),
        };

        localStorage.setItem(
          WebRTCManager.STORAGE_KEY,
          JSON.stringify(transfers),
        );
      }
    } catch (error) {
      console.error("Error saving transfer state:", error);
    }
  }

  private cleanupOldTransfers() {
    try {
      const savedState = localStorage.getItem(WebRTCManager.STORAGE_KEY);
      if (savedState) {
        const transfers = JSON.parse(savedState) as TransferSessionStorage;
        const now = Date.now();

        // Remove old transfers
        let modified = false;
        Object.entries(transfers).forEach(([sessionId, data]) => {
          if (
            now - data.lastUpdate > WebRTCManager.MAX_STORAGE_AGE ||
            data.state.completed
          ) {
            delete transfers[sessionId];
            modified = true;
          }
        });

        if (modified) {
          localStorage.setItem(
            WebRTCManager.STORAGE_KEY,
            JSON.stringify(transfers),
          );
        }
      }
    } catch (error) {
      console.error("Error cleaning up transfers:", error);
      localStorage.removeItem(WebRTCManager.STORAGE_KEY);
    }
  }

  private createTransferSession(
    file: File,
    targetDevice: string,
  ): TransferSession {
    const session: TransferSession = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      fileSize: file.size,
      targetDevice,
      startTime: Date.now(),
      lastChunkIndex: -1,
      completed: false,
      totalChunks: Math.ceil(file.size / this.chunkSize),
      checksum: "", // TODO: Implement file checksum
    };
    this.activeTransferSession = session;
    this.saveTransferState();
    return session;
  }

  private updateTransferSession(chunkIndex: number, completed = false) {
    if (this.activeTransferSession) {
      this.activeTransferSession.lastChunkIndex = chunkIndex;
      this.activeTransferSession.completed = completed;
      this.saveTransferState();
    }
  }

  public async sendFile(file: File, targetDevice: string) {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket connection is not open");
      }

      // Check for existing incomplete session
      if (
        this.activeTransferSession?.targetDevice === targetDevice &&
        this.activeTransferSession?.fileName === file.name &&
        !this.activeTransferSession.completed
      ) {
        const resumeConfirmed = confirm(
          `Found incomplete transfer for ${
            file.name
          }. Would you like to resume from ${Math.round(
            (this.activeTransferSession.lastChunkIndex /
              this.activeTransferSession.totalChunks) *
              100,
          )}%?`,
        );

        if (!resumeConfirmed) {
          this.activeTransferSession = null;
        }
      } else {
        this.activeTransferSession = this.createTransferSession(
          file,
          targetDevice,
        );
      }

      // Send file transfer request with session info
      console.log("Sending file transfer request to:", targetDevice);
      this.ws.send(
        JSON.stringify({
          type: "file-request",
          targetDevice,
          fileName: file.name,
          fileSize: file.size,
          sessionId: this.activeTransferSession?.id,
          lastChunkIndex: this.activeTransferSession?.lastChunkIndex,
        }),
      );

      // Wait for acceptance
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingTransfers.delete(targetDevice);
          reject(new Error("File transfer request timed out"));
        }, 60000);

        this.pendingTransfers.set(targetDevice, {
          accept: () => {
            clearTimeout(timeout);
            resolve();
          },
          reject: () => {
            clearTimeout(timeout);
            reject(new Error("File transfer was rejected"));
          },
        });
      });

      // Setup WebRTC connection
      await this.setupConnection(targetDevice);

      // Send the file
      await this.sendFileData(file);

      // Mark session as completed
      if (this.activeTransferSession) {
        this.updateTransferSession(
          this.activeTransferSession.totalChunks - 1,
          true,
        );
      }

      this.logTransfer({
        timestamp: Date.now(),
        fileName: file.name,
        fileSize: file.size,
        type: "send",
        success: true,
        peerName: targetDevice,
      });
    } catch (error) {
      this.logError("Error sending file", "FILE_SEND_ERROR", error);
      this.logTransfer({
        timestamp: Date.now(),
        fileName: file.name,
        fileSize: file.size,
        type: "send",
        success: false,
        peerName: targetDevice,
      });
      throw error;
    }
  }

  private async sendFileData(file: File) {
    return new Promise<void>((resolve, reject) => {
      if (!this.activeTransferSession) {
        reject(new Error("No active transfer session"));
        return;
      }

      if (file.size > 1024 * 1024 * 1024) {
        // 1GB limit
        reject(new Error("File size exceeds maximum allowed size of 1GB"));
        return;
      }

      let offset =
        (this.activeTransferSession.lastChunkIndex + 1) * this.chunkSize;
      let sentChunks = this.activeTransferSession.lastChunkIndex + 1;
      const totalChunks = this.activeTransferSession.totalChunks;

      const sendNextChunk = () => {
        if (offset >= file.size) {
          resolve();
          return;
        }

        if (!this.dataChannel || this.dataChannel.readyState !== "open") {
          reject(new Error("Data channel is not available"));
          return;
        }

        // Read the next chunk
        const chunk = file.slice(offset, offset + this.chunkSize);
        const chunkReader = new FileReader();

        chunkReader.onload = () => {
          try {
            if (!this.dataChannel) throw new Error("No data channel available");

            const data = chunkReader.result as ArrayBuffer;
            // Add chunk index metadata
            const metadata = new TextEncoder().encode(
              JSON.stringify({
                index: sentChunks,
                isLast: offset + data.byteLength >= file.size,
              }),
            );

            // Combine metadata length (4 bytes), metadata, and chunk data
            const metadataLength = new Uint32Array([metadata.length]);
            const combinedData = new Uint8Array(
              4 + metadata.length + data.byteLength,
            );
            combinedData.set(new Uint8Array(metadataLength.buffer), 0);
            combinedData.set(metadata, 4);
            combinedData.set(new Uint8Array(data), 4 + metadata.length);

            this.dataChannel.send(combinedData.buffer);

            offset += data.byteLength;
            sentChunks++;

            // Update session progress
            this.updateTransferSession(sentChunks - 1);

            const progress = sentChunks / totalChunks;
            this.notifyProgressListeners(progress);

            // Use requestAnimationFrame to avoid blocking the UI
            if (offset < file.size) {
              requestAnimationFrame(sendNextChunk);
            } else {
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        };

        chunkReader.onerror = () => reject(chunkReader.error);
        chunkReader.readAsArrayBuffer(chunk);
      };

      // Start sending chunks
      sendNextChunk();
    });
  }

  private handleReceivedData(data: ArrayBuffer) {
    try {
      // Extract metadata length from first 4 bytes
      const metadataLength = new Uint32Array(data.slice(0, 4))[0];

      // Extract and parse metadata
      const metadataBytes = new Uint8Array(data.slice(4, 4 + metadataLength));
      const metadata = JSON.parse(new TextDecoder().decode(metadataBytes));

      // Extract chunk data
      const chunkData = data.slice(4 + metadataLength);

      // Initialize chunk storage for new transfers
      if (!this.receivedChunks.has(this.currentFileName)) {
        this.receivedChunks.set(this.currentFileName, []);
      }

      const chunks = this.receivedChunks.get(this.currentFileName)!;
      chunks[metadata.index] = chunkData;

      this.receivedSize += chunkData.byteLength;
      this.lastReceivedChunkIndex = metadata.index;

      // Save state after each chunk
      this.saveTransferState();

      const progress = this.receivedSize / this.expectedFileSize;
      this.notifyProgressListeners(progress);

      // Check if file is complete
      if (metadata.isLast && this.receivedSize >= this.expectedFileSize) {
        this.assembleAndDownloadFile();
      }
    } catch (error) {
      console.error("Error processing received data:", error);
      this.logError(
        "Error processing received chunk",
        "CHUNK_PROCESSING_ERROR",
        error,
      );
    }
  }

  private assembleAndDownloadFile() {
    try {
      console.log("Assembling file:", this.currentFileName);

      const chunks = this.receivedChunks.get(this.currentFileName);
      if (!chunks) {
        throw new Error("No chunks found for file");
      }

      // Filter out any undefined chunks and convert to Uint8Array
      const validChunks = chunks.filter(Boolean);
      const completeFile = new Blob(validChunks);

      console.log("Created blob with size:", completeFile.size);

      // Create and trigger download
      const downloadUrl = URL.createObjectURL(completeFile);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = this.currentFileName;
      downloadLink.style.display = "none";
      document.body.appendChild(downloadLink);

      console.log("Triggering download for:", this.currentFileName);
      downloadLink.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadUrl);
      }, 100);

      console.log("File download triggered:", this.currentFileName);

      // Log successful transfer
      this.logTransfer({
        timestamp: Date.now(),
        fileName: this.currentFileName,
        fileSize: this.expectedFileSize,
        type: "receive",
        success: true,
        peerName: "received",
      });

      // Reset state
      this.receivedChunks.delete(this.currentFileName);
      this.receivedSize = 0;
      this.expectedFileSize = 0;
      this.currentFileName = "";
      this.lastReceivedChunkIndex = -1;
      this.updateTransferSession(this.lastReceivedChunkIndex, true); //Mark Session as complete
    } catch (error) {
      console.error("Error downloading file:", error);
      this.logError(
        "Error assembling and downloading file",
        "FILE_DOWNLOAD_ERROR",
        error,
      );
    }
  }
  private setupDataChannel() {
    if (!this.dataChannel) return;

    // Configure data channel for large file transfers
    const config = {
      ordered: true,
      maxRetransmits: 3,
      maxPacketLifeTime: 5000, // 5 seconds
    };

    // If needed, create a new data channel with proper config
    if (this.peerConnection && this.dataChannel.maxRetransmits === undefined) {
      this.dataChannel = this.peerConnection.createDataChannel(
        "fileTransfer",
        config,
      );
      if (!this.dataChannel) return;
    }

    const channel = this.dataChannel;
    channel.binaryType = "arraybuffer";

    // Set buffer threshold
    channel.bufferedAmountLowThreshold = 65536 * 8; // 512KB buffer threshold

    channel.onopen = () => {
      console.log("Data channel opened");
      this.notifyStatusListeners({
        connected: true,
        activeConnections: this.connectedPeers.size,
        lastPingTime: Date.now(),
      });
    };

    channel.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        console.log("Received chunk, size:", event.data.byteLength);
        this.handleReceivedData(event.data);
      } else {
        console.error("Received unexpected data type:", typeof event.data);
      }
    };

    channel.onerror = (error) => {
      console.error("Data channel error:", error);
      this.logError("Data channel error occurred", "DATA_CHANNEL_ERROR", error);
    };

    channel.onclose = () => {
      console.log("Data channel closed");
      this.cleanup();
    };

    channel.onbufferedamountlow = () => {
      console.log("Buffer amount low, ready to send more data");
    };
  }

  private async setupConnection(targetDevice: string): Promise<void> {
    try {
      console.log("Setting up WebRTC connection to:", targetDevice);
      const pc = await this.createPeerConnection(targetDevice);

      this.dataChannel = pc.createDataChannel("fileTransfer", {
        ordered: true,
        maxRetransmits: 3,
      });
      this.setupDataChannel();

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("Sending WebRTC offer to:", targetDevice);
      this.ws.send(
        JSON.stringify({
          type: "offer",
          offer,
          targetDevice,
        }),
      );

      // Wait for connection with retries
      let retries = 3;
      while (retries > 0) {
        try {
          await new Promise<void>((resolve, reject) => {
            if (!this.dataChannel) {
              return reject(new Error("No data channel available"));
            }

            const timeout = setTimeout(() => {
              reject(new Error("WebRTC connection timeout"));
            }, 30000); // 30 second timeout per attempt

            const checkState = () => {
              console.log(
                "Connection state:",
                pc.connectionState,
                "Channel state:",
                this.dataChannel?.readyState,
              );

              if (this.dataChannel?.readyState === "open") {
                clearTimeout(timeout);
                resolve();
              } else if (
                pc.connectionState === "failed" ||
                pc.connectionState === "closed"
              ) {
                clearTimeout(timeout);
                reject(new Error(`Connection failed: ${pc.connectionState}`));
              }
            };

            this.dataChannel.onopen = checkState;
            pc.onconnectionstatechange = checkState;
            checkState(); // Check immediately in case already connected
          });

          console.log("WebRTC connection established successfully");
          return; // Connection successful, exit retry loop
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          console.log(`Connection attempt failed, retries left: ${retries}`);
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait before retry
        }
      }
    } catch (error) {
      console.error("Failed to setup WebRTC connection:", error);
      throw error;
    }
  }

  private async createPeerConnection(
    targetDevice?: string,
  ): Promise<RTCPeerConnection> {
    if (this.peerConnection?.connectionState !== "closed") {
      await this.cleanup();
    }

    const config: RTCConfiguration = {
      iceServers: [], // Remove STUN servers to restrict to local network only
      iceTransportPolicy: "all",
    };

    this.peerConnection = new RTCPeerConnection(config);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && targetDevice) {
        // Only allow local network candidates
        const candidateStr = event.candidate.candidate.toLowerCase();
        if (candidateStr.includes("host")) {
          // Only allow host (local) candidates
          console.log("Sending local ICE candidate to:", targetDevice);
          this.ws.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: event.candidate,
              targetDevice,
            }),
          );
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log(
        "Connection state changed:",
        this.peerConnection?.connectionState,
      );
      if (this.peerConnection?.connectionState === "failed") {
        this.logError("WebRTC connection failed", "WEBRTC_CONNECTION_FAILED");
      }
    };

    return this.peerConnection;
  }

  private async handleOffer(message: WebRTCMessage) {
    try {
      const pc = await this.createPeerConnection();
      console.log("Handling offer...");

      pc.ondatachannel = (event) => {
        console.log("Received data channel");
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };

      if (message.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.ws.send(
          JSON.stringify({
            type: "answer",
            answer,
            targetDevice: message.sourceDevice,
          }),
        );
      }
    } catch (error) {
      console.error("Error handling offer:", error);
      throw error;
    }
  }

  private async handleAnswer(message: WebRTCMessage) {
    try {
      if (!this.peerConnection) {
        throw new Error("No peer connection when handling answer");
      }
      if (message.answer) {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(message.answer),
        );
        console.log("Successfully set remote description from answer");
      }
    } catch (error) {
      console.error("Error handling answer:", error);
      throw error;
    }
  }

  private async handleIceCandidate(message: WebRTCMessage) {
    try {
      if (!this.peerConnection) {
        throw new Error("No peer connection when handling ICE candidate");
      }
      if (message.candidate) {
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(message.candidate),
        );
        console.log("Successfully added ICE candidate");
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  }

  public acceptFileTransfer(sourceDeviceId: string) {
    if (!this.incomingFileRequest) {
      console.error("No pending file request to accept");
      return;
    }

    console.log("Accepting file transfer from:", sourceDeviceId);

    // Set up file reception state
    this.currentFileName = this.incomingFileRequest.fileName;
    this.expectedFileSize = this.incomingFileRequest.fileSize;
    this.receivedChunks.set(this.currentFileName, []);
    this.receivedSize = 0;

    console.log(
      "Set up file reception for:",
      this.currentFileName,
      "size:",
      this.expectedFileSize,
    );

    // Send acceptance
    this.ws.send(
      JSON.stringify({
        type: "file-accept",
        sourceDevice: sourceDeviceId,
      }),
    );

    // Clear the request
    this.incomingFileRequest = null;
  }

  public rejectFileTransfer(deviceId: string) {
    console.log("Rejecting file transfer from:", deviceId);
    this.ws.send(
      JSON.stringify({
        type: "file-reject",
        sourceDevice: deviceId,
      }),
    );
  }

  private setupWebSocket() {
    this.ws.onopen = () => {
      console.log("WebSocket connected successfully");
      this.reconnectAttempts = 0;
      this.notifyStatusListeners({
        connected: true,
        activeConnections: this.connectedPeers.size,
        lastPingTime: Date.now(),
      });
    };

    this.ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data) as WebRTCMessage;
        console.log("Received WebSocket message:", message.type);

        switch (message.type) {
          case "device-discovered":
            if (message.device) {
              this.connectedPeers.add(message.device.id);
              this.notifyDeviceListeners(message.device);
            }
            break;
          case "device-disconnected":
            if (message.deviceId) {
              this.connectedPeers.delete(message.deviceId);
              this.notifyDisconnectListeners(message.deviceId);
            }
            break;
          case "offer":
            await this.handleOffer(message);
            break;
          case "answer":
            await this.handleAnswer(message);
            break;
          case "ice-candidate":
            await this.handleIceCandidate(message);
            break;
          case "file-request":
            if (message.fileName && message.fileSize && message.sourceDevice) {
              this.notifyFileRequestListeners({
                fileName: message.fileName,
                fileSize: message.fileSize,
                sourceDevice: message.sourceDevice,
              });
            }
            break;
          case "file-accepted":
            const transfer = this.pendingTransfers.get(message.targetDevice!);
            if (transfer) {
              transfer.accept();
              this.pendingTransfers.delete(message.targetDevice!);
            }
            break;
          case "file-rejected":
            const rejectedTransfer = this.pendingTransfers.get(
              message.targetDevice!,
            );
            if (rejectedTransfer) {
              rejectedTransfer.reject();
              this.pendingTransfers.delete(message.targetDevice!);
            }
            break;
        }
      } catch (error) {
        this.logError(
          "Error processing WebSocket message",
          "WS_MESSAGE_ERROR",
          error,
        );
      }
    };

    this.ws.onclose = async () => {
      console.log("WebSocket connection closed");
      this.notifyStatusListeners({
        connected: false,
        activeConnections: 0,
      });

      // Attempt reconnection if not reached max attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(
          `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.setupWebSocket();
      } else {
        this.logError(
          "Maximum reconnection attempts reached",
          "WS_MAX_RECONNECT",
        );
      }
    };

    this.ws.onerror = (error) => {
      this.logError("WebSocket connection error", "WS_CONNECTION_ERROR", error);
    };
  }

  public onDeviceDiscovered(callback: (device: Device) => void) {
    this.deviceListeners.push(callback);
  }

  public onDeviceDisconnected(callback: (deviceId: string) => void) {
    this.disconnectListeners.push(callback);
  }

  public onTransferProgress(callback: (progress: number) => void) {
    this.progressListeners.push(callback);
  }

  public onFileRequest(callback: (request: FileTransferRequest) => void) {
    this.fileRequestListeners.push(callback);
  }

  private notifyDeviceListeners(device: Device) {
    this.deviceListeners.forEach((listener) => listener(device));
  }

  private notifyDisconnectListeners(deviceId: string) {
    this.disconnectListeners.forEach((listener) => listener(deviceId));
  }

  private notifyProgressListeners(progress: number) {
    this.progressListeners.forEach((listener) => listener(progress));
  }

  private notifyFileRequestListeners(request: FileTransferRequest) {
    this.incomingFileRequest = request;
    this.fileRequestListeners.forEach((listener) => listener(request));
  }

  public async cleanup() {
    try {
      if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
      }
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }

  // Add new methods for diagnostic data access
  public getTransferLogs(): TransferLog[] {
    return [...this.transferLogs];
  }

  public getErrorLogs(): ErrorLog[] {
    return [...this.errorLogs];
  }

  public getSystemStatus(): SystemStatus {
    return {
      connected: this.ws.readyState === WebSocket.OPEN,
      activeConnections: this.connectedPeers.size,
    };
  }

  public onStatus(callback: (status: SystemStatus) => void) {
    this.statusListeners.push(callback);
  }

  public onError(callback: (error: ErrorLog) => void) {
    this.errorListeners.push(callback);
  }

  private notifyStatusListeners(status: SystemStatus) {
    this.statusListeners.forEach((listener) => listener(status));
  }

  private notifyErrorListeners(error: ErrorLog) {
    this.errorListeners.forEach((listener) => listener(error));
  }
  private logError(message: string, code?: string, details?: unknown) {
    const errorLog: ErrorLog = {
      timestamp: Date.now(),
      message,
      code,
      details,
    };
    this.errorLogs.push(errorLog);
    this.notifyErrorListeners(errorLog);
    console.error(`[WebRTC Error] ${message}`, details);
  }

  private logTransfer(log: TransferLog) {
    this.notifyTransferLogListeners(log);
    // Keep only last 50 transfer logs
    if (this.transferLogs.length > 50) {
      this.transferLogs.shift();
    }
  }

  private startPingInterval() {
    setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
        this.notifyStatusListeners({
          connected: true,
          activeConnections: this.connectedPeers.size,
          lastPingTime: Date.now(),
        });
      } else {
        this.notifyStatusListeners({
          connected: false,
          activeConnections: 0,
        });
      }
    }, 5000);
  }

  public onStatusUpdate(callback: (status: SystemStatus) => void) {
    this.statusListeners.push(callback);
  }

  public onTransferLog(callback: (log: TransferLog) => void) {
    this.transferLogListeners.push(callback);
  }

  public onActiveTransfersUpdate(
    callback: (transfers: TransferSession[]) => void,
  ) {
    this.activeTransferListeners.push(callback);
  }

  private notifyTransferLogListeners(log: TransferLog) {
    this.transferLogs.push(log);
    this.transferLogListeners.forEach((listener) => listener(log));
  }

  private notifyActiveTransferListeners(transfers: TransferSession[]) {
    this.activeTransferListeners.forEach((listener) => listener(transfers));
  }
}

import type { Express } from "express";
import { createServer, type Server, type IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";

interface Device {
  id: string;
  name: string;
  ws: WebSocket;
  networkAddress: string;
  networkId: string;
}

function generateNetworkId(headers: any, address: string): string {
  // For CloudFlare Zero Trust connections, use CF headers
  if (process.env.NODE_ENV === "production") {
    const cfZeroTrust = headers["cf-zero-trust-client-ip"];
    if (cfZeroTrust) return `cf-${cfZeroTrust}`;

    const cfConnectingIp = headers["cf-connecting-ip"];
    if (cfConnectingIp) return `cf-${cfConnectingIp}`;
  }

  // For local development or non-CF connections, use IP subnet
  const ipv4 = address.replace(/^::ffff:/, "");
  const subnet = ipv4.split(".").slice(0, 3).join(".");
  return `local-${subnet}`;
}

function isLocalNetwork(address: string, headers: any): boolean {
  // In production with CloudFlare, trust CF headers
  if (process.env.NODE_ENV === "production") {
    const cfConnecting =
      headers["cf-connecting-ip"] || headers["cf-worker"] || headers["cf-ray"];

    if (cfConnecting) {
      const cfZeroTrust =
        headers["cf-zero-trust-client-ip"] || headers["cf-connecting-ip"];
      if (cfZeroTrust) {
        return true;
      }
    }
  }

  // For development or non-CloudFlare environments
  const ipv4 = address.replace(/^::ffff:/, "");
  if (ipv4 === "127.0.0.1" || ipv4 === "localhost") return true;
  if (process.env.NODE_ENV === "development") return true;

  return false;
}

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    perMessageDeflate: false,
    clientTracking: true,
    handleProtocols: (protocols: Set<string>, request: IncomingMessage) => {
      if (!protocols.size) return false;
      return protocols.has("ws") ? "ws" : false;
    },
  });

  const devices = new Map<string, Device>();
  const pendingTransfers = new Map<string, string>();

  wss.on("connection", (ws, req) => {
    const ip =
      (req.headers["cf-connecting-ip"] as string) ||
      (req.headers["x-forwarded-for"] as string) ||
      req.socket.remoteAddress?.replace(/^::ffff:/, "") ||
      "";

    console.log(`Connection attempt from IP: ${ip}`);

    if (!isLocalNetwork(ip, req.headers)) {
      console.log(`Rejecting connection from: ${ip}`);
      ws.close(1008, "Connection not allowed");
      return;
    }

    const networkId = generateNetworkId(req.headers, ip);
    const deviceId = Math.random().toString(36).substring(7);
    let deviceName = `Device ${deviceId.toUpperCase()}`;

    console.log(
      `New device connected: ${deviceId} from: ${ip} (Network: ${networkId})`
    );

    const device: Device = {
      id: deviceId,
      name: deviceName,
      ws,
      networkAddress: ip,
      networkId,
    };

    devices.set(deviceId, device);

    // Don't broadcast the device until it sets its nickname
    // Just send existing devices to the new device
    devices.forEach((existingDevice, existingId) => {
      if (
        existingId !== deviceId &&
        existingDevice.networkId === networkId &&
        existingDevice.ws.readyState === WebSocket.OPEN
      ) {
        ws.send(
          JSON.stringify({
            type: "device-discovered",
            device: {
              id: existingId,
              name: existingDevice.name,
              connected: true,
            },
          })
        );
      }
    });

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`[${deviceId}] Received message type: ${data.type}`);

        switch (data.type) {
          case "set-nickname":
            deviceName = data.nickname;
            device.name = deviceName;

            // Now broadcast the device with its custom nickname to all peers
            devices.forEach((dev) => {
              if (
                dev.id !== deviceId &&
                dev.ws.readyState === WebSocket.OPEN &&
                dev.networkId === networkId
              ) {
                dev.ws.send(
                  JSON.stringify({
                    type: "device-discovered",
                    device: {
                      id: deviceId,
                      name: deviceName,
                      connected: true,
                    },
                  })
                );
              }
            });
            break;

          case "file-request":
            console.log(
              `[${deviceId}] File transfer request to ${data.targetDevice}`
            );
            const targetDevice = devices.get(data.targetDevice);

            if (
              targetDevice &&
              targetDevice.ws.readyState === WebSocket.OPEN &&
              targetDevice.networkId === networkId
            ) {
              try {
                pendingTransfers.set(deviceId, data.targetDevice);
                targetDevice.ws.send(
                  JSON.stringify({
                    type: "file-request",
                    fileName: data.fileName,
                    fileSize: data.fileSize,
                    sourceDevice: deviceId,
                  })
                );

                ws.send(
                  JSON.stringify({
                    type: "file-request-sent",
                    targetDevice: data.targetDevice,
                    fileName: data.fileName,
                  })
                );
              } catch (error) {
                console.error(`Error forwarding file request:`, error);
                ws.send(
                  JSON.stringify({
                    type: "error",
                    message: "Failed to forward file request",
                  })
                );
              }
            } else {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message:
                    "Target device not available or not in the same network",
                })
              );
            }
            break;

          case "file-accept":
          case "file-reject":
            const sourceDevice = devices.get(data.sourceDevice);
            if (
              sourceDevice &&
              sourceDevice.ws.readyState === WebSocket.OPEN &&
              sourceDevice.networkId === networkId
            ) {
              sourceDevice.ws.send(
                JSON.stringify({
                  type:
                    data.type === "file-accept"
                      ? "file-accepted"
                      : "file-rejected",
                  targetDevice: deviceId,
                })
              );
            }
            break;

          case "offer":
          case "answer":
          case "ice-candidate":
            const target = devices.get(data.targetDevice);
            if (
              target &&
              target.ws.readyState === WebSocket.OPEN &&
              target.networkId === networkId
            ) {
              console.log(
                `[${deviceId}] Forwarding ${data.type} to ${data.targetDevice}`
              );
              const message = { ...data, sourceDevice: deviceId };
              target.ws.send(JSON.stringify(message));
            }
            break;

          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;
        }
      } catch (error) {
        console.error(`[${deviceId}] Error processing message:`, error);
      }
    });

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping();
        } catch (error) {
          console.error(`[${deviceId}] Error sending ping:`, error);
          clearInterval(pingInterval);
          ws.terminate();
        }
      }
    }, 30000);

    ws.on("close", () => {
      console.log(`Device ${deviceId} disconnected`);
      clearInterval(pingInterval);
      devices.delete(deviceId);
      pendingTransfers.delete(deviceId);

      // Notify only devices in the same network about disconnection
      devices.forEach((dev) => {
        if (
          dev.ws.readyState === WebSocket.OPEN &&
          dev.networkId === networkId
        ) {
          dev.ws.send(
            JSON.stringify({
              type: "device-disconnected",
              deviceId,
            })
          );
        }
      });
    });

    ws.on("error", (error) => {
      console.error(`[${deviceId}] WebSocket error:`, error);
      clearInterval(pingInterval);
    });
  });

  return httpServer;
}

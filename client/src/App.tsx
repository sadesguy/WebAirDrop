import { useEffect, useState, useCallback } from "react";
import { FileTransfer } from "@/components/FileTransfer";
import { DeviceList } from "@/components/DeviceList";
import { DiagnosticDashboard } from "@/components/DiagnosticDashboard";
import { ConnectionLoader } from "@/components/ConnectionLoader";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Wifi } from "lucide-react";
import { WebRTCManager } from "@/lib/webrtc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Device, SystemStatus, TransferLog, ErrorLog } from "@/lib/types";
import React from "react";

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [nickname, setNickname] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionProgress, setConnectionProgress] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState(
    "Initializing connection...",
  );
  const [webrtc, setWebrtc] = useState<WebRTCManager | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    connected: false,
    activeConnections: 0,
  });
  const [transferLogs, setTransferLogs] = useState<TransferLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const { toast } = useToast();

  const handleConnect = useCallback(() => {
    if (!nickname.trim()) {
      toast({
        title: "Nickname Required",
        description: "Please enter a nickname for your device",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsConnecting(true);
      setConnectionProgress(0);
      setConnectionStatus("Initializing connection...");

      // Get the current window location and construct WebSocket URL
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
      console.log("Connecting to WebSocket:", wsUrl);

      // Create WebSocket with explicit protocol and additional headers if needed
      const ws = new WebSocket(wsUrl, ["ws"]);

      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          clearInterval(progressInterval);
          ws.close();
          setIsConnecting(false);
          toast({
            title: "Connection Timeout",
            description: "Failed to establish connection. Please try again.",
            variant: "destructive",
          });
        }
      }, 5000);

      // Simulate connection progress
      const progressInterval = setInterval(() => {
        setConnectionProgress((prev) => {
          const next = Math.min(prev + Math.random() * 15, 90);
          return next;
        });
      }, 500);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        clearInterval(progressInterval);
        setConnectionProgress(100);
        setConnectionStatus("Connected! Setting up secure channel...");

        // Set CloudFlare-friendly headers in the initial message
        ws.send(
          JSON.stringify({
            type: "set-nickname",
            nickname: nickname.trim(),
            headers: {
              "X-Forwarded-For": window.location.hostname,
              "X-Real-IP": window.location.hostname,
            },
          }),
        );

        // Only create WebRTCManager after successful connection
        const rtcManager = new WebRTCManager(ws);

        rtcManager.onDeviceDiscovered((device: Device) => {
          console.log("Device discovered:", device);
          setDevices((prev) => {
            if (prev.some((d) => d.id === device.id)) {
              return prev.map((d) =>
                d.id === device.id ? { ...d, connected: true } : d,
              );
            }
            return [...prev, device];
          });
        });

        rtcManager.onDeviceDisconnected((deviceId: string) => {
          console.log("Device disconnected:", deviceId);
          setDevices((prev) => prev.filter((d) => d.id !== deviceId));
          if (selectedDevice?.id === deviceId) {
            setSelectedDevice(null);
            toast({
              title: "Device Disconnected",
              description: "The selected device has disconnected",
              variant: "destructive",
            });
          }
        });

        rtcManager.onStatusUpdate((status: SystemStatus) => {
          setSystemStatus(status);
        });

        rtcManager.onTransferLog((log: TransferLog) => {
          setTransferLogs((prev) => [...prev.slice(-49), log]);
        });

        rtcManager.onError((error: ErrorLog) => {
          setErrorLogs((prev) => [...prev.slice(-49), error]);
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        });

        setWebrtc(rtcManager);
        setIsConnected(true);
        setIsConnecting(false);
        toast({
          title: "Connected",
          description: "Successfully connected to the local network",
        });
      };

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        clearInterval(progressInterval);
        console.error("WebSocket connection error:", error);
        setConnectionStatus("Connection failed. Please try again.");
        toast({
          title: "Connection Error",
          description:
            "Failed to connect to the local network. Make sure you're on the same network.",
          variant: "destructive",
        });
        setIsConnecting(false);
        setIsConnected(false);
        setWebrtc(null);
      };

      ws.onclose = () => {
        clearTimeout(connectionTimeout);
        clearInterval(progressInterval);
        console.log("WebSocket connection closed");
        setConnectionStatus("Connection closed.");
        setIsConnecting(false);
        setIsConnected(false);
        setWebrtc(null);
        setDevices([]);
        toast({
          title: "Disconnected",
          description: "Connection to the network was lost. Please reconnect.",
          variant: "destructive",
        });
      };
    } catch (error) {
      console.error("Error initializing connection:", error);
      setConnectionStatus("Failed to initialize connection.");
      toast({
        title: "Connection Error",
        description: "Failed to initialize connection. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  }, [nickname, toast, selectedDevice]);

  useEffect(() => {
    return () => {
      if (webrtc) {
        console.log("Cleaning up WebRTC on unmount");
        webrtc.cleanup();
      }
    };
  }, [webrtc]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="webdrop-theme">
      <div className="min-h-screen w-full bg-gradient-to-b from-background to-muted p-2 sm:p-4">
        <Card className="max-w-3xl mx-auto mt-4 sm:mt-8">
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <Wifi className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  WebDrop
                </h1>
              </div>
              <ThemeToggle />
            </div>

            {!isConnected ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="nickname" className="text-sm font-medium">
                    Device Nickname
                  </label>
                  <Input
                    id="nickname"
                    placeholder="Enter a nickname for your device"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                    disabled={isConnecting}
                    className="h-10"
                  />
                </div>

                <ConnectionLoader
                  isConnecting={isConnecting}
                  progress={connectionProgress}
                  statusMessage={connectionStatus}
                />

                {!isConnecting && (
                  <Button
                    className="w-full h-10 text-base"
                    onClick={handleConnect}
                  >
                    Connect to Network
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                <Card className="border shadow-sm">
                  <CardContent className="p-3 sm:p-4">
                    <DeviceList
                      devices={devices}
                      selectedDevice={selectedDevice}
                      onDeviceSelect={setSelectedDevice}
                    />
                  </CardContent>
                </Card>

                {webrtc && (
                  <FileTransfer
                    webrtc={webrtc}
                    selectedDevice={selectedDevice}
                  />
                )}

                <Card className="border shadow-sm">
                  <CardContent className="p-3 sm:p-4">
                    <DiagnosticDashboard
                      status={systemStatus}
                      transferLogs={transferLogs}
                      errorLogs={errorLogs}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ThemeProvider>
  );
}

export default App;

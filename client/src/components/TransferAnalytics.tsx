import { useEffect, useState } from "react";
import { SpeedBenchmark } from "@/components/SpeedBenchmark";
import { DiagnosticDashboard } from "@/components/DiagnosticDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import React from "react";

import {
  Activity,
  Download,
  Upload,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  RefreshCcw,
} from "lucide-react";
import type {
  SystemStatus,
  TransferLog,
  ErrorLog,
  TransferSession,
  SpeedData,
} from "@/lib/types";

interface TransferAnalyticsProps {
  status: SystemStatus;
  transferLogs: TransferLog[];
  errorLogs: ErrorLog[];
  currentSpeed?: number;
  peakSpeed: number;
  averageSpeed: number;
  speedHistory: SpeedData[];
  activeTransfers: TransferSession[];
  onRetryTransfer?: (session: TransferSession) => void;
}

export function TransferAnalytics({
  status,
  transferLogs,
  errorLogs,
  currentSpeed = 0,
  peakSpeed,
  averageSpeed,
  speedHistory,
  activeTransfers,
  onRetryTransfer,
}: TransferAnalyticsProps) {
  const [successRate, setSuccessRate] = useState<number>(0);
  const [totalTransferred, setTotalTransferred] = useState<number>(0);

  useEffect(() => {
    if (transferLogs.length > 0) {
      const successful = transferLogs.filter((log) => log.success).length;
      setSuccessRate((successful / transferLogs.length) * 100);

      const total = transferLogs.reduce((acc, log) => acc + log.fileSize, 0);
      setTotalTransferred(total);
    }
  }, [transferLogs]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="active">Active Transfers</TabsTrigger>
        <TabsTrigger value="history">Transfer History</TabsTrigger>
        <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Connection Status
              </CardTitle>
              {status.connected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {status.activeConnections} peers
              </div>
              <p className="text-xs text-muted-foreground">
                Last ping:{" "}
                {status.lastPingTime
                  ? new Date(status.lastPingTime).toLocaleString()
                  : "N/A"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {successRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {transferLogs.length} total transfers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Transferred
              </CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatSize(totalTransferred)}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Peak Speed</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatSize(peakSpeed)}/s
              </div>
              <p className="text-xs text-muted-foreground">
                Average: {formatSize(averageSpeed)}/s
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transfer Speed</CardTitle>
          </CardHeader>
          <CardContent>
            <SpeedBenchmark
              currentSpeed={currentSpeed}
              peakSpeed={peakSpeed}
              averageSpeed={averageSpeed}
              speedHistory={speedHistory}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="active" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Active Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {activeTransfers.map((transfer) => (
                  <Card key={transfer.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{transfer.fileName}</div>
                        <Badge
                          variant={transfer.completed ? "default" : "secondary"}
                        >
                          {transfer.completed ? "Completed" : "In Progress"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Size</p>
                          <p>{formatSize(transfer.fileSize)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Progress</p>
                          <p>
                            {Math.round(
                              (transfer.lastChunkIndex / transfer.totalChunks) *
                                100,
                            )}
                            %
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Started</p>
                          <p>{new Date(transfer.startTime).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Target</p>
                          <p>{transfer.targetDevice}</p>
                        </div>
                      </div>
                      {!transfer.completed && onRetryTransfer && (
                        <button
                          onClick={() => onRetryTransfer(transfer)}
                          className="mt-4 flex items-center text-sm text-blue-500 hover:text-blue-700"
                        >
                          <RefreshCcw className="mr-1 h-4 w-4" />
                          Resume Transfer
                        </button>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {activeTransfers.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No active transfers
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Transfer History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {transferLogs.map((log, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between border-b border-border last:border-0 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {log.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <div>
                        <p className="font-medium">{log.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{log.type}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatSize(log.fileSize)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="diagnostics">
        <DiagnosticDashboard
          status={status}
          transferLogs={transferLogs}
          errorLogs={errorLogs}
        />
      </TabsContent>
    </Tabs>
  );
}

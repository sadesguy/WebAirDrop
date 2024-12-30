import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, Wifi, WifiOff } from "lucide-react";
import type { SystemStatus, TransferLog, ErrorLog } from "../lib/types";
import React from "react";


interface DiagnosticDashboardProps {
  status: SystemStatus;
  transferLogs: TransferLog[];
  errorLogs: ErrorLog[];
}

export function DiagnosticDashboard({
  status,
  transferLogs,
  errorLogs,
}: DiagnosticDashboardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            {status.connected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-sm">Connected</span>
                <Badge variant="outline" className="ml-auto">
                  {status.activeConnections} connected peers
                </Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-destructive" />
                <span className="text-sm">Disconnected</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Transfer History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[120px]">
            {transferLogs.map((log, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 py-1 text-sm"
              >
                {log.success ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="flex-1 truncate">{log.fileName}</span>
                <Badge variant="outline" className="ml-2">
                  {log.type}
                </Badge>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Error Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {errorLogs.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="text-sm font-medium">{error.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(error.timestamp).toLocaleString()}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

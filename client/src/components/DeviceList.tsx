import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Computer } from "lucide-react";
import type { Device } from "@/lib/types";
import React from "react";

interface DeviceListProps {
  devices: Device[];
  selectedDevice: Device | null;
  onDeviceSelect: (device: Device) => void;
}

export function DeviceList({
  devices,
  selectedDevice,
  onDeviceSelect,
}: DeviceListProps) {
  if (devices.length === 0) {
    return (
      <div className="text-center py-8 bg-muted/30 rounded-lg">
        <Computer className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Searching for nearby devices...
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px] rounded-md border">
      <div className="p-4 space-y-2">
        {devices.map((device) => (
          <Button
            key={device.id}
            variant={selectedDevice?.id === device.id ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => onDeviceSelect(device)}
          >
            <Computer className="mr-2 h-4 w-4" />
            {device.name}
            <span className="ml-auto text-xs text-muted-foreground">
              {device.connected ? "Connected" : "Available"}
            </span>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}

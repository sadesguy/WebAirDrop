import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import React from "react";


interface ProgressModalProps {
  isOpen: boolean;
  fileName: string;
  fileSize: number;
  progress: number;
  speed?: number;
  timeRemaining?: number;
}

export function ProgressModal({
  isOpen,
  fileName,
  fileSize,
  progress,
  speed,
  timeRemaining,
}: ProgressModalProps) {
  const [startTime] = useState(() => Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalTime, setTotalTime] = useState<number | null>(null);
  const [timeProgress, setTimeProgress] = useState(0);
  const [prevProgress, setPrevProgress] = useState(0);

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - startTime) / 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Calculate progress based on elapsed vs total time
  useEffect(() => {
    if (timeRemaining && elapsedTime > 0) {
      const estimatedTotal = elapsedTime + timeRemaining;
      setTotalTime(estimatedTotal);

      const calculatedProgress = (elapsedTime / estimatedTotal) * 100;
      const newProgress = Math.min(
        100,
        Math.max(prevProgress, calculatedProgress),
      );
      setTimeProgress(newProgress);
      setPrevProgress(newProgress);
    }
  }, [timeRemaining, elapsedTime, prevProgress]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatTime = (seconds?: number) => {
    if (!seconds || !Number.isFinite(seconds)) return "Calculating...";
    if (seconds === 0) return "Complete";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.ceil(seconds % 60);

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const formatSpeed = (bytesPerSecond?: number) => {
    if (!bytesPerSecond || !Number.isFinite(bytesPerSecond))
      return "Calculating...";
    if (bytesPerSecond === 0) return "0 B/s";
    const k = 1024;
    const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return `${parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2))} ${
      sizes[i]
    }`;
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <motion.div
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <FileText className="h-5 w-5" />
            </motion.div>
            File Transfer Progress
          </DialogTitle>
          <DialogDescription>Transferring {fileName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Progress
              value={timeProgress}
              className="h-2"
              // Add transition styles for smoother animation
              style={{
                transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
            <motion.p layout className="font-medium mt-2" key={timeProgress}>
              {Math.round(timeProgress)}%
            </motion.p>
          </div>
          <motion.div
            layout
            className="grid grid-cols-2 gap-4 text-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div>
              <p className="text-muted-foreground">File Size</p>
              <p className="font-medium">{formatSize(fileSize)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Progress</p>
              <motion.p layout className="font-medium" key={timeProgress}>
                {Math.round(timeProgress)}%
              </motion.p>
            </div>
            <div>
              <p className="text-muted-foreground">Speed</p>
              <motion.p layout className="font-medium" key={speed}>
                {formatSpeed(speed)}
              </motion.p>
            </div>
            <div>
              <p className="text-muted-foreground">Time Remaining</p>
              <motion.p layout className="font-medium" key={timeRemaining}>
                {formatTime(timeRemaining)}
              </motion.p>
            </div>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

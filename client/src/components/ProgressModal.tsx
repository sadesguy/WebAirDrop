import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    return `${Math.round(seconds)}s`;
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
            <Progress value={progress} className="h-2" />
            <motion.div
              className="absolute left-0 top-0 h-2 w-full bg-primary/10 rounded-full"
              animate={{
                scale: [1, 1.02, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </div>
          <motion.div
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
              <motion.p
                className="font-medium"
                key={progress}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {Math.round(progress)}%
              </motion.p>
            </div>
            <div>
              <p className="text-muted-foreground">Speed</p>
              <motion.p
                className="font-medium"
                key={speed}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {formatSpeed(speed)}
              </motion.p>
            </div>
            <div>
              <p className="text-muted-foreground">Time Remaining</p>
              <motion.p
                className="font-medium"
                key={timeRemaining}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {formatTime(timeRemaining)}
              </motion.p>
            </div>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

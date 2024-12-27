import { useState, useCallback, useEffect, useRef } from "react";
import { DropZone } from "@/components/DropZone";
import { ProgressModal } from "@/components/ProgressModal";
import { TransferAnalytics } from "@/components/TransferAnalytics";
import { Card } from "@/components/ui/card";
import { Send, X, File as FileIcon, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type {
  Device,
  TransferLog,
  ErrorLog,
  SystemStatus,
  TransferSession,
} from "@/lib/types";
import type { WebRTCManager } from "@/lib/webrtc";
import { motion, AnimatePresence } from "framer-motion";

// Animation variants for container
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Animation variants for items
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
};

// Add progress bar animation variants
const progressVariants = {
  initial: {
    scaleX: 0,
    originX: 0,
  },
  animate: (progress: number) => ({
    scaleX: progress / 100,
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  }),
};

interface FileTransferProps {
  webrtc: WebRTCManager | null;
  selectedDevice: Device | null;
}

interface PendingFile {
  file: File;
  progress: number;
  status: "pending" | "transferring" | "completed" | "error";
  error?: string;
  uniqueId?: string; // Uniqe transfer check
}

export function FileTransfer({ webrtc, selectedDevice }: FileTransferProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [currentTransfer, setCurrentTransfer] = useState<PendingFile | null>(
    null
  );
  const [transferSpeed, setTransferSpeed] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [speedHistory, setSpeedHistory] = useState<
    { time: number; speed: number }[]
  >([]);
  const [peakSpeed, setPeakSpeed] = useState<number>(0);
  const [averageSpeed, setAverageSpeed] = useState<number>(0);
  const lastUpdateTime = useRef(Date.now());
  const lastProgress = useRef(0);
  const startTime = useRef<number>(0);
  const speedUpdateInterval = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [incomingFile, setIncomingFile] = useState<{
    fileName: string;
    fileSize: number;
    sourceDevice: string;
  } | null>(null);

  // Analytics state
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    connected: false,
    activeConnections: 0,
  });
  const [transferLogs, setTransferLogs] = useState<TransferLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<TransferSession[]>([]);

  useEffect(() => {
    if (webrtc) {
      webrtc.onTransferProgress((progress) => {
        if (!currentTransfer) return;

        const now = Date.now();
        const timeDiff = (now - lastUpdateTime.current) / 1000;
        const progressDiff = progress - lastProgress.current;

        if (timeDiff > 0) {
          const bytesTransferred = progressDiff * currentTransfer.file.size;
          const speed = bytesTransferred / timeDiff;

          if (
            !speedUpdateInterval.current ||
            now - speedUpdateInterval.current >= 1000
          ) {
            setTransferSpeed(speed);
            setPeakSpeed((prev) => Math.max(prev, speed));

            const elapsedTime = Math.floor((now - startTime.current) / 1000);

            setSpeedHistory((prev) => {
              const newHistory = [...prev, { time: elapsedTime, speed }];
              return newHistory.slice(-30);
            });

            const totalTransferred = progress * currentTransfer.file.size;
            const totalTime = Math.max(0.1, (now - startTime.current) / 1000);
            const avgSpeed = totalTransferred / totalTime;
            setAverageSpeed(avgSpeed);

            if (speed > 0 && progress < 1) {
              const remainingBytes = (1 - progress) * currentTransfer.file.size;
              const estimatedSeconds = remainingBytes / speed;
              setTimeRemaining(Math.max(0, Math.ceil(estimatedSeconds)));
            } else if (progress >= 1) {
              setTimeRemaining(0);
            }

            speedUpdateInterval.current = now;
          }
        }

        lastUpdateTime.current = now;
        lastProgress.current = progress;

        // Update progress for current file
        setPendingFiles((prev) =>
          prev.map((f) =>
            f === currentTransfer
              ? {
                  ...f,
                  progress: progress * 100,
                  status: progress >= 1 ? "completed" : "transferring",
                  isCompleted: progress >= 1, // Add explicit completion flag
                }
              : f
          )
        );

        // If completed, ensure we clean up properly
        if (progress >= 1) {
          setTimeout(() => {
            setCurrentTransfer(null);
            // Remove completed file from pending list
            setPendingFiles((prev) =>
              prev.filter((f) => f !== currentTransfer)
            );
          }, 1000); // Give UI time to show completion
        }
      });

      webrtc.onFileRequest((request) => {
        setIncomingFile(request);
      });

      webrtc.onStatusUpdate((status) => {
        setSystemStatus(status);
      });

      webrtc.onTransferLog((log) => {
        setTransferLogs((prev) => [log, ...prev]);
      });

      webrtc.onError((error) => {
        setErrorLogs((prev) => [error, ...prev]);

        // Update status of current transfer if error occurs
        if (currentTransfer) {
          setPendingFiles((prev) =>
            prev.map((f) =>
              f === currentTransfer
                ? {
                    ...f,
                    status: "error",
                    error:
                      error instanceof Error
                        ? error.message
                        : "Transfer failed",
                  }
                : f
            )
          );
          setCurrentTransfer(null);
        }
      });

      webrtc.onActiveTransfersUpdate((transfers) => {
        setActiveTransfers(transfers);
      });
    }
  }, [webrtc, currentTransfer]);

  const handleFileDrop = useCallback(
    (files: FileList) => {
      const maxSize = 1024 * 1024 * 1024; // 1GB
      const newFiles: PendingFile[] = [];

      Array.from(files).forEach((file) => {
        if (file.size > maxSize) {
          toast({
            title: "File Too Large",
            description: `${file.name} exceeds maximum size of 1GB`,
            variant: "destructive",
          });
        } else {
          newFiles.push({
            file,
            progress: 0,
            status: "pending",
          });
        }
      });

      setPendingFiles((prev) => [...prev, ...newFiles]);
    },
    [toast]
  );

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const startNextTransfer = useCallback(async () => {
    if (!webrtc || !selectedDevice || currentTransfer) return;

    // Check for next pending file that hasn't been completed
    const nextFile = pendingFiles.find(
      (f) =>
        f.status === "pending" &&
        !transferLogs.some(
          (log) =>
            log.fileName === f.file.name &&
            log.fileSize === f.file.size &&
            log.success
        )
    );

    if (!nextFile) return;

    try {
      setCurrentTransfer(nextFile);
      setPendingFiles((prev) =>
        prev.map((f) =>
          f === nextFile
            ? {
                ...f,
                status: "transferring",
                uniqueId: `${Date.now()}-${f.file.name}`, // Add unique identifier
              }
            : f
        )
      );

      startTime.current = Date.now();
      lastUpdateTime.current = Date.now();
      lastProgress.current = 0;
      setSpeedHistory([]);
      setTimeRemaining(null);

      await webrtc.sendFile(nextFile.file, selectedDevice.id);

      setPendingFiles((prev) =>
        prev.map((f) => (f === nextFile ? { ...f, status: "completed" } : f))
      );

      // Start next transfer if available
      setCurrentTransfer(null);
      startNextTransfer();
    } catch (error) {
      setPendingFiles((prev) =>
        prev.map((f) =>
          f === nextFile
            ? {
                ...f,
                status: "error",
                error:
                  error instanceof Error ? error.message : "Transfer failed",
              }
            : f
        )
      );
      setCurrentTransfer(null);
    }
  }, [webrtc, selectedDevice, currentTransfer, pendingFiles, transferLogs]);

  useEffect(() => {
    if (!currentTransfer) {
      startNextTransfer();
    }
  }, [currentTransfer, startNextTransfer]);

  const handleAcceptTransfer = () => {
    if (!webrtc || !incomingFile) return;
    webrtc.acceptFileTransfer(incomingFile.sourceDevice);
    setIncomingFile(null);
  };

  const handleRejectTransfer = () => {
    if (!webrtc || !incomingFile) return;
    webrtc.rejectFileTransfer(incomingFile.sourceDevice);
    setIncomingFile(null);
  };

  const removeFile = (file: PendingFile) => {
    if (file === currentTransfer) return; // Can't remove active transfer
    setPendingFiles((prev) => prev.filter((f) => f !== file));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-4">
          <AnimatePresence mode="wait">
            {pendingFiles.length === 0 ? (
              <motion.div
                key="empty-state"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  >
                    <DropZone onDrop={handleFileDrop} multiple />
                  </motion.div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) =>
                      e.target.files && handleFileDrop(e.target.files)
                    }
                  />
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Button
                      variant="outline"
                      onClick={handleFileSelect}
                      className="mt-4 w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Select Files
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="file-list"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between mb-3">
                  <motion.h3
                    variants={itemVariants}
                    className="text-sm font-medium"
                  >
                    Files ({pendingFiles.length})
                  </motion.h3>
                  <motion.div variants={itemVariants} className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFileSelect}
                      className="h-8"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingFiles([])}
                      disabled={!!currentTransfer}
                      className="h-8"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </motion.div>
                </div>

                <div className="space-y-2 max-h-[40vh] overflow-y-auto px-1 -mx-1">
                  <AnimatePresence initial={false}>
                    {pendingFiles.map((file, index) => (
                      <motion.div
                        key={`${file.file.name}-${index}`}
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        exit={{ opacity: 0, x: -20 }}
                        className={`
                          relative rounded-lg border p-3
                          ${
                            file.status === "transferring"
                              ? "bg-primary/5 border-primary/20"
                              : "bg-muted/50"
                          }
                          ${
                            file.status === "completed"
                              ? "bg-green-500/5 border-green-500/20"
                              : ""
                          }
                          ${
                            file.status === "error"
                              ? "bg-red-500/5 border-red-500/20"
                              : ""
                          }
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <motion.div
                            initial={{ rotate: -45 }}
                            animate={{ rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200 }}
                          >
                            <FileIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {file.file.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                              <span>{formatFileSize(file.file.size)}</span>
                              {file.status === "transferring" && (
                                <span className="text-primary">
                                  {file.progress.toFixed(1)}%
                                </span>
                              )}
                              {file.status === "completed" && (
                                <motion.span
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="text-green-500"
                                >
                                  Complete
                                </motion.span>
                              )}
                              {file.status === "error" && (
                                <motion.span
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="text-red-500"
                                >
                                  Failed
                                </motion.span>
                              )}
                            </div>
                            {file.error && (
                              <motion.p
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-1 text-xs text-red-500 truncate"
                              >
                                {file.error}
                              </motion.p>
                            )}
                            {file.status === "transferring" && (
                              <div className="mt-2 relative h-1.5 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  className="absolute top-0 left-0 h-full bg-primary rounded-full"
                                  initial="initial"
                                  animate="animate"
                                  variants={progressVariants}
                                  custom={file.progress}
                                  style={{
                                    width: "100%",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          {file.status !== "transferring" && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  if (file !== currentTransfer) {
                                    setPendingFiles((prev) =>
                                      prev.filter((f) => f !== file)
                                    );
                                  }
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <TransferAnalytics
          status={systemStatus}
          transferLogs={transferLogs}
          errorLogs={errorLogs}
          currentSpeed={transferSpeed}
          peakSpeed={peakSpeed}
          averageSpeed={averageSpeed}
          speedHistory={speedHistory}
          activeTransfers={activeTransfers}
          onRetryTransfer={() => {
            if (currentTransfer?.status === "error") {
              setPendingFiles((prev) =>
                prev.map((f) =>
                  f === currentTransfer
                    ? { ...f, status: "pending", error: undefined }
                    : f
                )
              );
              setCurrentTransfer(null);
            }
          }}
        />
      </Card>

      <AnimatePresence>
        {currentTransfer && (
          <ProgressModal
            isOpen={true}
            fileName={currentTransfer.file.name}
            fileSize={currentTransfer.file.size}
            progress={currentTransfer.progress}
            speed={transferSpeed}
            timeRemaining={timeRemaining ?? undefined}
          />
        )}
      </AnimatePresence>

      <AlertDialog open={incomingFile !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Incoming File Transfer</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <div className="font-medium">{incomingFile?.fileName}</div>
                <div className="text-sm text-muted-foreground">
                  Size:{" "}
                  {incomingFile ? formatFileSize(incomingFile.fileSize) : "0 B"}
                </div>
                <div className="mt-4">Would you like to accept this file?</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:space-x-2">
            <AlertDialogCancel
              className="w-full sm:w-auto"
              onClick={() => {
                if (webrtc && incomingFile) {
                  webrtc.rejectFileTransfer(incomingFile.sourceDevice);
                  setIncomingFile(null);
                }
              }}
            >
              Reject
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto"
              onClick={() => {
                if (webrtc && incomingFile) {
                  webrtc.acceptFileTransfer(incomingFile.sourceDevice);
                  setIncomingFile(null);
                }
              }}
            >
              Accept
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import React from "react";


interface ConnectionLoaderProps {
  isConnecting: boolean;
  progress: number;
  statusMessage: string;
}

export function ConnectionLoader({
  isConnecting,
  progress,
  statusMessage,
}: ConnectionLoaderProps) {
  return (
    <AnimatePresence mode="wait">
      {isConnecting && (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-8 h-8 text-primary" />
            </motion.div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Connecting to network
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <motion.p
            key={statusMessage}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-center text-muted-foreground"
          >
            {statusMessage}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

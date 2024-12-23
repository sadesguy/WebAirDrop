import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface SpeedData {
  time: number;
  speed: number;
}

interface SpeedBenchmarkProps {
  currentSpeed?: number; // in bytes per second
  peakSpeed: number;
  averageSpeed: number;
  speedHistory: SpeedData[];
}

export function SpeedBenchmark({
  currentSpeed = 0,
  peakSpeed,
  averageSpeed,
  speedHistory,
}: SpeedBenchmarkProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
    const timeout = setTimeout(() => setAnimate(false), 200);
    return () => clearTimeout(timeout);
  }, [currentSpeed]);

  const formatSpeed = (speed: number) => {
    if (speed === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(speed) / Math.log(k));
    return `${parseFloat((speed / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const chartData = speedHistory.slice(-30); // Keep only last 30 data points for performance

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Transfer Speed</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current</p>
            <motion.div
              animate={animate ? { scale: 1.1 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Badge variant="outline" className="font-mono">
                {formatSpeed(currentSpeed)}
              </Badge>
            </motion.div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Peak</p>
            <Badge variant="outline" className="font-mono">
              {formatSpeed(peakSpeed)}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Average</p>
            <Badge variant="outline" className="font-mono">
              {formatSpeed(averageSpeed)}
            </Badge>
          </div>
        </div>

        <div className="h-[120px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} key={chartData.length}>
              <XAxis
                dataKey="time"
                tickFormatter={(value) => `${value}s`}
                stroke="#888888"
                fontSize={12}
                domain={['dataMin', 'dataMax']}
              />
              <YAxis
                tickFormatter={formatSpeed}
                stroke="#888888"
                fontSize={12}
                width={65}
                domain={[0, 'dataMax']}
              />
              <Tooltip
                formatter={(value: number) => [formatSpeed(value), "Speed"]}
                labelFormatter={(value) => `${value}s elapsed`}
              />
              <Line
                type="monotone"
                dataKey="speed"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
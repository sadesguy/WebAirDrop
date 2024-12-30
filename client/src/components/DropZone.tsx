import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import React from "react";

interface DropZoneProps {
  onDrop: (files: FileList) => void;

  multiple?: boolean;
}
export function DropZone({ onDrop }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        onDrop(files);
      }
    },
    [onDrop],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onDrop(e.target.files);
    }
  };

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-8
        ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25"
        }
        transition-colors duration-200
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={handleChange}
      />
      <div className="text-center">
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">
          Drop files here or click to select
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Share files securely with nearby devices
        </p>
      </div>
    </div>
  );
}

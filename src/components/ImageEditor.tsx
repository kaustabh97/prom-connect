import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Move, RotateCw, X, Check } from "lucide-react";

interface ImageEditorProps {
  imageUrl: string;
  onSave: (croppedImageUrl: string) => void;
  onCancel: () => void;
  aspectRatio?: number; // 1 = square, 4/5 = portrait, etc.
  shape?: "circle" | "square" | "rect";
}

export function ImageEditor({
  imageUrl,
  onSave,
  onCancel,
  aspectRatio = 1,
  shape = "circle",
}: ImageEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const MIN_SCALE = 1;
  const MAX_SCALE = 3;
  const ZOOM_STEP = 0.2;

  // Reset position when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setImageLoaded(false);
  }, [imageUrl]);

  // Calculate distance between two touches
  const getTouchDistance = (touches: TouchList): number => {
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle pointer events (works for both mouse and touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.touches?.length === 2) return; // Don't drag during pinch
    
    setIsDragging(true);
    setDragStart({ 
      x: e.clientX - position.x, 
      y: e.clientY - position.y 
    });
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || e.touches?.length === 2) return;
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
    e.preventDefault();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Handle touch pinch zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsDragging(false);
      setLastTouchDistance(getTouchDistance(e.touches));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance !== null) {
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scaleChange = currentDistance / lastTouchDistance;
      setScale((prev) => {
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev * scaleChange));
        return newScale;
      });
      setLastTouchDistance(currentDistance);
    }
  };

  const handleTouchEnd = () => {
    setLastTouchDistance(null);
  };

  // Zoom controls
  const handleZoomIn = () => {
    setScale((prev) => Math.min(MAX_SCALE, prev + ZOOM_STEP));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(MIN_SCALE, prev - ZOOM_STEP));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Crop and save with proper circular cropping
  const handleSave = () => {
    if (!imageRef.current || !containerRef.current || !imageContainerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;
    const imageContainer = imageContainerRef.current;
    
    // Get the crop area (circular overlay)
    const cropOverlay = container.querySelector(".crop-overlay") as HTMLElement;
    if (!cropOverlay) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get dimensions
    const cropRect = cropOverlay.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Crop size (circular)
    const cropSize = Math.min(cropRect.width, cropRect.height);
    canvas.width = cropSize;
    canvas.height = cropSize;

    // Create circular clipping path
    ctx.beginPath();
    ctx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2);
    ctx.clip();

    // Image natural and display dimensions
    const imgNaturalWidth = img.naturalWidth;
    const imgNaturalHeight = img.naturalHeight;
    const imgDisplayWidth = imgRect.width;
    const imgDisplayHeight = imgRect.height;

    // Scale factors (how many pixels in natural image = 1 pixel on screen)
    const scaleX = imgNaturalWidth / imgDisplayWidth;
    const scaleY = imgNaturalHeight / imgDisplayHeight;

    // Crop center in screen coordinates
    const cropCenterScreenX = cropRect.left + cropRect.width / 2;
    const cropCenterScreenY = cropRect.top + cropRect.height / 2;

    // Image top-left in screen coordinates
    const imgScreenX = imgRect.left;
    const imgScreenY = imgRect.top;

    // Crop center relative to image top-left (in screen pixels)
    const cropRelativeX = cropCenterScreenX - imgScreenX;
    const cropRelativeY = cropCenterScreenY - imgScreenY;

    // Convert to image natural coordinates
    const cropCenterImgX = cropRelativeX * scaleX;
    const cropCenterImgY = cropRelativeY * scaleY;

    // Crop radius in image coordinates
    const cropRadiusImg = (cropSize / 2) * scaleX; // Use scaleX assuming square crop

    // Source rectangle in image coordinates
    const sourceX = cropCenterImgX - cropRadiusImg;
    const sourceY = cropCenterImgY - cropRadiusImg;
    const sourceSize = cropRadiusImg * 2;

    // Draw cropped image
    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      cropSize,
      cropSize
    );

    // Convert to blob URL
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        onSave(url);
      }
    }, "image/jpeg", 0.95);
  };

  const containerClass = shape === "circle" 
    ? "rounded-full" 
    : shape === "square"
    ? "rounded-xl"
    : "rounded-xl";

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onTouchMove={(e) => e.preventDefault()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md flex flex-col h-full max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onCancel}
            className="text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
          <h3 className="font-display text-lg font-semibold text-white">Adjust your photo</h3>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSave}
            className="text-white hover:bg-white/10"
          >
            <Check className="w-5 h-5" />
          </Button>
        </div>

        {/* Image editor */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-0 bg-muted/20 rounded-xl overflow-hidden touch-none"
          style={{ aspectRatio }}
        >
          {/* Dark overlay outside crop area */}
          <div 
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: `radial-gradient(circle at center, transparent 0%, transparent 50%, rgba(0,0,0,0.7) 50%)`,
            }}
          />

          {/* Crop overlay border */}
          <div
            className={`crop-overlay absolute inset-0 ${containerClass} border-4 border-white/90 pointer-events-none z-20`}
            style={{ aspectRatio }}
          />

          {/* Grid overlay (rule of thirds) */}
          <div className={`absolute inset-0 ${containerClass} pointer-events-none z-15`}>
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1="33.33" y1="0" x2="33.33" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
              <line x1="66.66" y1="0" x2="66.66" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
              <line x1="0" y1="33.33" x2="100" y2="33.33" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
              <line x1="0" y1="66.66" x2="100" y2="66.66" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
            </svg>
          </div>

          {/* Image container */}
          <div 
            ref={imageContainerRef}
            className="absolute inset-0 flex items-center justify-center overflow-hidden"
            style={{ touchAction: "none" }}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Profile"
              className="select-none"
              style={{
                maxWidth: "none",
                maxHeight: "none",
                width: "200%",
                height: "200%",
                objectFit: "cover",
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: "center center",
                transition: isDragging || lastTouchDistance !== null ? "none" : "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
              onLoad={() => setImageLoaded(true)}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              draggable={false}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center justify-center gap-3 px-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={scale <= MIN_SCALE}
            className="h-11 w-11 bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ZoomOut className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
            <Move className="w-4 h-4 text-white/80" />
            <span className="text-sm font-medium text-white">
              {Math.round(scale * 100)}%
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={scale >= MAX_SCALE}
            className="h-11 w-11 bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ZoomIn className="w-5 h-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
            className="h-11 w-11 bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <RotateCw className="w-5 h-5" />
          </Button>
        </div>

        {/* Instructions */}
        <p className="text-center text-sm text-white/70 mt-4 px-2">
          Pinch to zoom • Drag to reposition
        </p>
      </motion.div>
    </div>
  );
}

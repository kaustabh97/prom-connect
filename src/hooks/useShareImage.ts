import { useCallback, useState } from "react";
import html2canvas from "html2canvas";
import { logError, logInfo } from "@/utils/logger";

export function useShareImage() {
  const [isSharing, setIsSharing] = useState(false);

  const captureAndShare = useCallback(
    async (
      element: HTMLElement,
      options: {
        filename?: string;
        shareTitle?: string;
        shareText?: string;
        imageUrls?: string[];
      } = {}
    ) => {
      const {
        filename = "starlitbythebrick-share.png",
        shareTitle = "Starlit by the Brick",
        shareText = "Check out Starlit by the Brick!",
        imageUrls = [],
      } = options;

      logInfo("Share image: capturing", { component: "useShareImage", operation: "captureAndShare", extra: { filename } });
      setIsSharing(true);
      try {
        const imageDataUrls: Record<string, string> = {};
        await Promise.all(
          imageUrls.map(async (url) => {
            try {
              const res = await fetch(url, { mode: "cors" });
              if (!res.ok) return;
              const blob = await res.blob();
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              imageDataUrls[url] = dataUrl;
            } catch (err) {
              logError(err, { component: "useShareImage", operation: "fetchImageAsDataUrl", extra: { url } });
            }
          })
        );

        const imgs = element.querySelectorAll("img[src^='http']");
        const restores: { img: HTMLImageElement; src: string }[] = [];
        imgs.forEach((img) => {
          const src = img.getAttribute("src");
          if (src && imageDataUrls[src]) {
            restores.push({ img: img as HTMLImageElement, src });
            img.setAttribute("src", imageDataUrls[src]);
          }
        });

        await Promise.all(
          restores.map(({ img }) =>
            img.decode ? img.decode().catch(() => {}) : Promise.resolve()
          )
        );

        const canvas = await html2canvas(element, {
          backgroundColor: "#0f1729",
          scale: 2,
          useCORS: true,
          logging: false,
        });

        restores.forEach(({ img, src }) => img.setAttribute("src", src));

        return new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Failed to create image"));
            },
            "image/png",
            0.95
          );
        }).then(async (blob) => {
          const file = new File([blob], filename, { type: "image/png" });
          if (navigator.share) {
            try {
              logInfo("Share image: invoking navigator.share", { component: "useShareImage", operation: "captureAndShare" });
              await navigator.share({
                files: [file],
                title: shareTitle,
                text: shareText,
              });
              logInfo("Share image: shared successfully", { component: "useShareImage", operation: "captureAndShare" });
            } catch (e) {
              if ((e as Error).name !== "AbortError") {
                logError(e, { component: "useShareImage", operation: "navigator.share" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
              }
            }
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
          }
        });
      } finally {
        setIsSharing(false);
      }
    },
    []
  );

  return { captureAndShare, isSharing };
}

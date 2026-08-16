function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This photograph could not be read."));
    };
    image.src = url;
  });
}

export async function makeLabelJpeg(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  thumbnail = false,
) {
  const image = await loadImage(file);
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = thumbnail ? maxWidth : width;
  canvas.height = thumbnail ? maxHeight : height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("This photograph could not be prepared.");

  context.fillStyle = "#f6f0e6";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    thumbnail ? Math.round((maxWidth - width) / 2) : 0,
    thumbnail ? Math.round((maxHeight - height) / 2) : 0,
    width,
    height,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("This photograph could not be prepared.");
  return { blob, width: canvas.width, height: canvas.height };
}

export function thumbnailPath(storagePath: string) {
  return storagePath.replace(/\.jpg$/, "-thumb.jpg");
}

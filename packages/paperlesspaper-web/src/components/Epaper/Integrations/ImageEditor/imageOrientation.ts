type Size = { width: number; height: number };

// Project the frame onto the image axes, including rotated photographs.
const coverScale = (image: any, frame: Size) => {
  const angle = ((image.angle || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return Math.max(
    (frame.width * cos + frame.height * sin) / image.width,
    (frame.width * sin + frame.height * cos) / image.height
  );
};

export function resizeImageForOrientation(
  image: any,
  previous: Size,
  next: Size
) {
  const ratio = coverScale(image, next) / coverScale(image, previous);
  const center = image.getCenterPoint();
  image.set({ scaleX: image.scaleX * ratio, scaleY: image.scaleY * ratio });
  image.setPositionByOrigin(
    center.setXY(
      next.width / 2 + (center.x - previous.width / 2) * ratio,
      next.height / 2 + (center.y - previous.height / 2) * ratio
    ),
    "center",
    "center"
  );
  image.setCoords();
}


export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
};

export const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

export const getTextColor = (hex: string | undefined) => {
  if (!hex) return 'black';
  const {r, g, b} = hexToRgb(hex);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#000000' : '#ffffff';
};

// --- CIELAB Color Space Utils ---

interface LabColor {
  l: number;
  a: number;
  b: number;
}

// Convert RGB to XYZ, then to LAB
export const rgbToLab = (r: number, g: number, b: number): LabColor => {
  let red = r / 255;
  let green = g / 255;
  let blue = b / 255;

  red = red > 0.04045 ? Math.pow((red + 0.055) / 1.055, 2.4) : red / 12.92;
  green = green > 0.04045 ? Math.pow((green + 0.055) / 1.055, 2.4) : green / 12.92;
  blue = blue > 0.04045 ? Math.pow((blue + 0.055) / 1.055, 2.4) : blue / 12.92;

  let x = (red * 0.4124 + green * 0.3576 + blue * 0.1805) * 100;
  let y = (red * 0.2126 + green * 0.7152 + blue * 0.0722) * 100;
  let z = (red * 0.0193 + green * 0.1192 + blue * 0.9505) * 100;

  x = x / 95.047;
  y = y / 100.000;
  z = z / 108.883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);

  return {
    l: (116 * y) - 16,
    a: 500 * (x - y),
    b: 200 * (y - z)
  };
};

// CIE76 Distance (Euclidean distance in LAB space)
export const deltaE = (lab1: LabColor, lab2: LabColor): number => {
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
};

/**
 * Removes isolated stray pixels ("noise") from the grid.
 * SMART UPDATE: 
 * It now checks the Color Difference (DeltaE) between the stray pixel and its neighbors.
 * @param threshold The DeltaE threshold. If color diff > threshold, the pixel is preserved.
 *                  Higher threshold = Stronger denoise (removes more pixels).
 *                  Lower threshold = Weaker denoise (preserves more pixels).
 */
export const denoiseGrid = (
  grid: { [key: string]: string }, 
  minX: number, 
  maxX: number, 
  minY: number, 
  maxY: number,
  colorMap: Record<string, { hex: string }>,
  threshold: number = 55
): { [key: string]: string } => {
  const newGrid = { ...grid };
  const get = (x: number, y: number) => grid[`${x},${y}`];

  // We iterate through the existing grid cells
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const currentId = get(x, y);
      if (!currentId) continue;

      const neighbors: string[] = [];
      // Check 8 neighbors
      const offsets = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0],           [1, 0],
        [-1, 1],  [0, 1],  [1, 1]
      ];

      offsets.forEach(([dx, dy]) => {
        const nColor = get(x + dx, y + dy);
        if (nColor) neighbors.push(nColor);
      });

      // If no neighbors, leave it.
      if (neighbors.length === 0) continue;

      // If the current color exists in neighbors, it's connected, so keep it.
      if (neighbors.includes(currentId)) continue;

      // --- ISOLATED PIXEL DETECTED ---
      
      // Find most frequent neighbor
      const counts: { [key: string]: number } = {};
      let maxColorId = neighbors[0];
      let maxCount = 0;

      neighbors.forEach(n => {
        counts[n] = (counts[n] || 0) + 1;
        if (counts[n] > maxCount) {
          maxCount = counts[n];
          maxColorId = n;
        }
      });

      // --- SMART CHECK: IS IT NOISE OR FEATURE? ---
      const currentColor = colorMap[currentId];
      const neighborColor = colorMap[maxColorId];

      if (currentColor && neighborColor) {
          const rgb1 = hexToRgb(currentColor.hex);
          const rgb2 = hexToRgb(neighborColor.hex);
          const lab1 = rgbToLab(rgb1.r, rgb1.g, rgb1.b);
          const lab2 = rgbToLab(rgb2.r, rgb2.g, rgb2.b);
          
          const distance = deltaE(lab1, lab2);
          
          // If distance is greater than threshold, we assume it's an intentional feature (e.g. an eye)
          // and we PRESERVE it.
          if (distance > threshold) {
              continue; 
          }
      }

      // If we are here, it's isolated AND low contrast (or below threshold) -> Replace it
      newGrid[`${x},${y}`] = maxColorId;
    }
  }
  return newGrid;
};

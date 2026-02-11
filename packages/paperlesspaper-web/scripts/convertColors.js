import * as fs from "fs";
import * as path from "path";

export const colorsMap = [
  "#000000", // black
  "#FFFFFF", // white
  "#0000FF", // blue
  "#00FF00", // green
  "#FF0000", // red
  "#FF4000", // midpoint between red and orange
  "#FF8000", // orange
  "#FFBF00", // midpoint between orange and yellow
  "#FFFF00", // yellow
];

export const colorsReal = [
  "#191E21", // black
  "#C6C3C2", // white
  "#30304C", // blue
  "#3C5330", // green
  "#6A181A", // red
  "#7D3024", // orange
  "#976D2E", // yellow
];

export const colorsSlightlyReal = [
  "#000000", // black
  "#ffffff", // white
  "#0000FF", // blue
  "#00FF00", // green
  "#D20E13", // red
  "#E03A1A", // midpoint between red and orange
  "#B85E1C", // orange
  "#CCA324", // midpoint between orange and yellow
  "#F3CF11", // yellow
];
function rgbToLab(rgb) {
  function pivot(n) {
    return n > 0.008856 ? Math.cbrt(n) : n * 7.787 + 16 / 116;
  }

  const [r, g, b] = rgb.map((v) => v / 255);

  const linearR = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  const linearG = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  const linearB = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const x =
    (linearR * 0.4124564 + linearG * 0.3575761 + linearB * 0.1804375) / 0.95047;
  const y =
    (linearR * 0.2126729 + linearG * 0.7151522 + linearB * 0.072175) / 1.0;
  const z =
    (linearR * 0.0193339 + linearG * 0.119192 + linearB * 0.9503041) / 1.08883;

  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);

  const lab = [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];

  // Special case for black, return LAB(0, 0, 0)
  if (rgb.every((v) => v === 0)) {
    return [0, 0, 0];
  }

  return lab;
}

// Converts a HEX color to RGB array
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

// Calculates Delta-E (CIEDE2000)
function deltaE(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const deltaL = L2 - L1;
  const deltaA = a2 - a1;
  const deltaB = b2 - b1;

  const c1 = Math.sqrt(a1 ** 2 + b1 ** 2);
  const c2 = Math.sqrt(a2 ** 2 + b2 ** 2);
  const deltaC = c2 - c1;

  const deltaH = Math.sqrt(
    Math.max(0, deltaA ** 2 + deltaB ** 2 - deltaC ** 2)
  );

  const sl = 1.0;
  const sc = 1.0 + 0.045 * c1;
  const sh = 1.0 + 0.015 * c1;

  const deltaE = Math.sqrt(
    (deltaL / sl) ** 2 + (deltaC / sc) ** 2 + (deltaH / sh) ** 2
  );

  return deltaE;
}
function findNearestColor(color, threshold) {
  const rgbColor = hexToRgb(color);
  const labColor = rgbToLab(rgbColor);

  let nearestColor = color;
  let minDeltaE = Infinity;

  for (const mapColor of colorsMap) {
    const mapRgb = hexToRgb(mapColor);
    const mapLab = rgbToLab(mapRgb);
    const delta = deltaE(labColor, mapLab);

    if (delta < minDeltaE) {
      minDeltaE = delta;
      nearestColor = mapColor;
    }
  }

  return minDeltaE <= threshold ? nearestColor : color;
}

function convertSvgColors(svgContent, threshold = 100) {
  return svgContent.replace(/#[0-9a-fA-F]{3,6}/g, (color) => {
    console.log(
      `Converting color ${color}`,
      findNearestColor(color, threshold)
    );
    return findNearestColor(color, threshold);
  });
}

// Function to replace colors in an SVG string
function replaceColorsInSVG(svgContent) {
  colorsMap.forEach((originalColor, index) => {
    const newColor = colorsSlightlyReal[index];
    const regex = new RegExp(originalColor, "gi"); // Case-insensitive match
    svgContent = svgContent.replace(regex, newColor);
  });
  return svgContent;
}

async function processSvgFile(inputPath, outputPath, threshold = 100) {
  const svgContent = fs.readFileSync(inputPath, "utf8");

  var svgCropped = convertSvgColors(svgContent, threshold);

  const response = await fetch("https://autocrop.cncf.io/autocrop", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ svg: svgContent, title: "new title" }),
  });

  const data = await response.json();
  svgCropped = data.result;

  // svgCropped = replaceColorsInSVG(svgCropped);

  fs.writeFileSync(outputPath, svgCropped, "utf8");
  console.log(`Updated SVG saved to ${outputPath}`);
}

function processFolder(inputFolder, outputFolder, threshold = 100) {
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const files = fs.readdirSync(inputFolder);
  files.forEach((file) => {
    const inputFilePath = path.join(inputFolder, file);

    const outputFilePath = path.join(outputFolder, file);

    if (path.extname(file).toLowerCase() === ".svg") {
      processSvgFile(inputFilePath, outputFilePath, threshold);
    } else {
      console.log(`Skipping non-SVG file: ${file}`);
    }
  });

  console.log(
    `All files in ${inputFolder} processed and saved to ${outputFolder}`
  );
}

processFolder(
  "./src/components/EpaperOverview/Icons/icons/cuteAnimalVectors",
  "./src/components/EpaperOverview/Icons/optimized/cuteAnimalVectorsConverted",
  10000
);

processFolder(
  "./src/components/EpaperOverview/Icons/icons/foodLineFilledVectors",
  "./src/components/EpaperOverview/Icons/optimized/foodLineFilledVectorsConverted",
  150
);

processFolder(
  "./src/components/EpaperOverview/Icons/icons/simpleDefault",
  "./src/components/EpaperOverview/Icons/optimized/simpleDefaultConverted",
  150
);

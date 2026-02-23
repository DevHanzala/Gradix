// PAPER UTILS - Helper Functions
export const PAGE_DIMENSIONS = {
  A4: [595.28, 841.89],
  A5: [420.94, 595.28],
  Letter: [612, 792],
};

export const getPageDimensions = (size) => {
  return PAGE_DIMENSIONS[size] || PAGE_DIMENSIONS.A4;
};

export const wrapText = (text, font, size, maxWidth, isRTL = false) => {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  
  for (const word of words) {
    const test = isRTL ? word + " " + line : line + word + " ";
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(isRTL ? line.trim().split(" ").reverse().join(" ") : line.trim());
      line = word + " ";
    } else {
      line = test;
    }
  }
  
  if (line) {
    lines.push(isRTL ? line.trim().split(" ").reverse().join(" ") : line.trim());
  }
  
  return lines;
};

export const sanitizeFileName = (fileName) => {
  return fileName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
};
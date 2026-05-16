export function lineAndColumn(
  content: string,
  index: number,
): { line: number; column: number } {
  const safeIndex = Math.max(0, Math.min(index, content.length));
  let line = 1;
  let column = 1;
  for (let i = 0; i < safeIndex; i++) {
    const ch = content.charCodeAt(i);
    if (ch === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

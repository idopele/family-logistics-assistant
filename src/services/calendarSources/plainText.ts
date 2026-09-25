export function toPlainText(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
}

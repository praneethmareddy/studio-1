export function generateRoomId(): string {
  // Generate a 6-character random alphanumeric string
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

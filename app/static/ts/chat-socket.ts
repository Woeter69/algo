// This module will handle all WebSocket event listeners and logic.

export function initializeSocketHandlers(socket: any) {
  socket.on("error", (err: any) => {
    console.error("WebSocket error:", err?.message || err);
  });

  socket.on("disconnect", (reason: string) => {
    console.warn("WebSocket disconnected:", reason);
  });

  socket.on("connect", () => {
    console.log("Go WebSocket connected successfully");
  });
}

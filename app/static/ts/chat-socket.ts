// This module will handle all WebSocket event listeners and logic.

// Define a type for the UI update callbacks
type UiUpdaters = {
  updateUserOnlineStatus: (userId: number, isOnline: boolean) => void;
};

export function initializeSocketHandlers(socket: any, uiUpdaters: UiUpdaters) {
  socket.on("error", (err: any) => {
    console.error("WebSocket error:", err?.message || err);
  });

  socket.on("disconnect", (reason: string) => {
    console.warn("WebSocket disconnected:", reason);
  });

  socket.on("connect", () => {
    console.log("Go WebSocket connected successfully");
  });

  socket.on("user_online", (data: any) => {
    console.log("User came online:", data);
    const userId = data.user_id || data.userID;
    uiUpdaters.updateUserOnlineStatus(userId, true);
  });

  socket.on("user_offline", (data: any) => {
    console.log("User went offline:", data);
    const userId = data.user_id || data.userID;
    uiUpdaters.updateUserOnlineStatus(userId, false);
  });
}

const { io } = require("socket.io-client");

// تابع برای راه‌اندازی اتصال سوکت
async function initSocket({
  wellId,
  serverAddress,
  token,
  onConnect,
  onDisconnect,
  onSocketError,
}) {
  const socket = io(serverAddress, {
    autoConnect: true,
    path: "/secure-ws",
    transports: ["websocket"],
    auth: { token },
    query: {
      wellId,
    },
  });

  // مدیریت اتصال سوکت
  socket.on("connect", () => {
    if (onConnect) onConnect(socket);
  });

  // مدیریت قطع اتصال سوکت
  socket.on("disconnect", async () => {
    if (onDisconnect) onDisconnect(socket);
  });

  // مدیریت خطاهای اتصال
  socket.on("connect_error", (err) => {
    if (onSocketError) onSocketError(socket, err);
  });

  socket.on("error", (err) => {
    if (onSocketError) onSocketError(socket, err);
  });
}

// تابع برای دریافت آخرین شناسه Master Log
async function getLastMasterLogId(socket, wellId) {
  return new Promise((resolve, reject) => {
    socket.emit("producer-last-masterlog", wellId, (ack) => {
      if (ack && ack.MaxId !== undefined) {
        resolve(ack.MaxId);
      } else {
        reject(new Error("Failed to retrieve MaxId for Master Log"));
      }
    });
  });
}

// تابع برای دریافت آخرین شناسه Comment
async function getLastCommentId(socket, wellId) {
  return new Promise((resolve, reject) => {
    socket.emit("producer-last-comment", wellId, (ack) => {
      if (ack && ack.MaxId !== undefined) {
        resolve(ack.MaxId);
      } else {
        reject(new Error("Failed to retrieve MaxId for Comment"));
      }
    });
  });
}

async function getLastCommentDeletedId(socket, wellId) {
  return new Promise((resolve, reject) => {
    socket.emit("producer-last-comment-deleted", wellId, (ack) => {
      if (ack && ack.MaxId !== undefined) {
        resolve(ack.MaxId);
      } else {
        reject(new Error("Failed to retrieve MaxId for Comment"));
      }
    });
  });
}


// صادرات توابع برای استفاده در دیگر فایل‌ها
module.exports = {
  initSocket,
  getLastCommentDeletedId,
  getLastMasterLogId,
  getLastCommentId,
};

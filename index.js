require("dotenv").config();

const { getToken, getTokenWithRetry } = require("./fetch");
const {
  hostDestination,
  hostLocal,
  sqlConfig,
  DESTINATION_API_PASSWORD,
  DESTINATION_API_USERNAME,
  INTERVAL_CONTROLLER,
  INTERVAL_COMMENTS,
  INTERVAL_COMMENTS_DELETED,
  INTERVAL_FAILED_PROCESS_DATA,
  INTERVAL_MASTERLOG,
  INTERVAL_MASTERLOG_DELETED,
  INTERVAL_DESTINATION_HEALTH,
  INTERVAL_TOKEN_DESTINATION,
  INTERVAL_TOKEN_LOCAL,
  TRANSFER,
  TRANSFER_COMMENTS,
  TRANSFER_COMMENTS_DELETED,
  TRANSFER_MASTERLOG,
  TRANSFER_MASTERLOG_DELETED,
  TRANSFER_FAILED_PROCESS_DATA,
  TRANSFER_ONLINE_PROCESS_DATA,
} = require("./config");
const { initSocket } = require("./socket");
const { TransferService } = require("./transfer");
const { DatabaseService, Orm } = require("./orm");

const sql = require("mssql");

let socketLocal = null;
let socketDestination = null;
let globalPool = null;
let wellInfo = null;

const wellId = process.argv[2];

if (!wellId || isNaN(wellId)) {
  console.error(
    "Error: Invalid or missing wellId. Please provide a valid number."
  );
  process.exit(1);
}

let globalOrm = null;
let globalTransfer = null;

// Initialize SQL Connection
async function initSQL() {
  try {
    const pool = await sql.connect(sqlConfig);
    const db = new DatabaseService(pool);

    console.log("# [Database] Connection established.");

    globalPool = pool;

    globalOrm = new Orm(db, wellId);
    wellInfo = await globalOrm.getWellById();

    globalTransfer = new TransferService(db, wellId, socketDestination);
  } catch (error) {
    console.error("Error connecting to SQL:", error);
    process.exit(1);
  }
}

let intervalComments = null; // متغیر برای ذخیره ارجاع به interval
let intervalCommentsDeleted = null; // برای کامنت‌شده‌ها
let intervalMasterLog = null; // برای کامنت‌شده‌ها
let intervalMasterLogDeleted = null; // برای کامنت‌شده‌ها
let intervalFailedProcessData = null; // برای کامنت‌شده‌ها

async function initSocketDestination() {
  const token = await getTokenWithRetry(
    hostDestination,
    process.env.LOCAL_API_USERNAME,
    process.env.LOCAL_API_PASSWORD,
    INTERVAL_TOKEN_DESTINATION
  );

  await initSocket({
    wellId: wellInfo.WellParentId,
    serverAddress: hostDestination,
    token: token,
    onConnect: async (socket) => {
      console.log("# [Destination] Socket connected");

      if (globalTransfer) globalTransfer.setSocket(socket);

      try {
        if (TRANSFER) {
          await globalTransfer.sendWell();

          if (TRANSFER_COMMENTS) {
            globalTransfer.sendComments();
            console.log(`# [Transfer] [Comments] Interval`);
            intervalComments = setInterval(
              () => globalTransfer.sendComments(),
              INTERVAL_COMMENTS
            );
          }

          if (TRANSFER_COMMENTS_DELETED) {
            globalTransfer.sendCommentsDeleted();
            console.log(`# [Transfer] [Comments Deleted] Interval`);
            intervalCommentsDeleted = setInterval(
              () => globalTransfer.sendCommentsDeleted(),
              INTERVAL_COMMENTS_DELETED
            );
          }

          if (TRANSFER_MASTERLOG) {
            globalTransfer.sendMasterLogs();
            console.log(
              `# [Transfer] [Master Log] Interval: ${INTERVAL_MASTERLOG}`
            );
            intervalMasterLog = setInterval(
              globalTransfer.sendMasterLogs,
              INTERVAL_MASTERLOG
            );
          }

          if (TRANSFER_MASTERLOG_DELETED) {
            globalTransfer.sendMasterLogsDeleted();
            console.log(
              `# [Transfer] [Master Log Deleted] Interval: ${INTERVAL_MASTERLOG_DELETED}`
            );
            intervalMasterLogDeleted = setInterval(
              globalTransfer.sendMasterLogsDeleted,
              INTERVAL_MASTERLOG_DELETED
            );
          }

          if (TRANSFER_FAILED_PROCESS_DATA) {
            globalTransfer.sendFailedData();
            console.log(`# [Transfer] [Failed Process Data] Interval`);
            intervalFailedProcessData = setInterval(
              () => globalTransfer.sendFailedData(),
              INTERVAL_FAILED_PROCESS_DATA
            );
          }
        }
      } catch (err) {
        console.error("# [Error] During transfer initialization:", err);
      }
    },
    onDisconnect: () => {
      console.log("# [Destination] Socket disconnected");

      // close connection
      globalTransfer.setSocket(null);

      // قطع کردن intervalها وقتی سوکت قطع می‌شود
      if (intervalComments) {
        clearInterval(intervalComments);
        console.log("# [Transfer] [Comments] Interval cleared");
      }

      if (intervalCommentsDeleted) {
        clearInterval(intervalCommentsDeleted);
        console.log("# [Transfer] [Comments Deleted] Interval cleared");
      }

      if (intervalMasterLog) {
        clearInterval(intervalMasterLog);
        console.log("# [Transfer] [Master Log] Interval cleared");
      }

      if (intervalMasterLogDeleted) {
        clearInterval(intervalMasterLogDeleted);
        console.log("# [Transfer] [Master Log Deleted] Interval cleared");
      }

      if (intervalFailedProcessData) {
        clearInterval(intervalFailedProcessData);
        console.log("# [Transfer] [Failed Process Data] Interval cleared");
      }
    },
  });
}

// Initialize Local Socket
async function initSocketLocal() {
  return initSocket({
    wellId: wellInfo.WellParentId,
    serverAddress: hostLocal,
    token: await getTokenWithRetry(
      hostLocal,
      DESTINATION_API_USERNAME,
      DESTINATION_API_PASSWORD,
      INTERVAL_TOKEN_LOCAL
    ),
    onConnect: async (socket) => {
      console.log("# [Local]       Socket connected");
      socketLocal = socket;
    },
    onDisconnect: async (socket) => {
      console.log("# [Local]       Socket disconnected");
      socketLocal = null;
    },
  });
}

async function initDataProcessing() {
  setInterval(async () => {
    const data = await globalOrm.getLastProcessData();

    if (socketLocal && socketLocal.connected) {
      socketLocal.emit("producer-processData-local", data);
    }

    await globalTransfer.sendProcessData(data);
  }, INTERVAL_CONTROLLER);
}

// Main Function
async function main() {
  try {
    await initSQL();
    initDataProcessing();
    initSocketDestination();
    initSocketLocal();
  } catch (error) {
    console.error(
      "# [Critical Error] Application initialization failed:",
      error
    );
    process.exit(1);
  }
}

// Start the application
main();

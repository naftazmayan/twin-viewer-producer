require("dotenv").config();

// لیست تمام متغیرهای ضروری
const requiredEnvVariables = [
  "DATABASE_HOST",
  "DATABASE_NAME",
  "DATABASE_USERNAME",
  "DATABASE_PASSWORD",
  "LOCAL_FASTIFY_PROTOCOL",
  "LOCAL_FASTIFY_HOST",
  "LOCAL_FASTIFY_PORT",
  "LOCAL_API_USERNAME",
  "LOCAL_API_PASSWORD",
  "DESTINATION_FASTIFY_PROTOCOL",
  "DESTINATION_FASTIFY_HOST",
  "DESTINATION_FASTIFY_PORT",
  "DESTINATION_API_USERNAME",
  "DESTINATION_API_PASSWORD",
  "BATCH_SIZE_COMMENTS",
  "BATCH_SIZE_COMMENTS_DELETED",
  "BATCH_SIZE_MASTERLOG",
  "BATCH_SIZE_MASTERLOG_DELETED",
  "BATCH_SIZE_FAILED_PROCESS_DATA",
  "INTERVAL_TOKEN_LOCAL",
  "INTERVAL_TOKEN_DESTINATION",
  "INTERVAL_CONTROLLER",
  "INTERVAL_COMMENTS",
  "INTERVAL_COMMENTS_DELETED",
  "INTERVAL_MASTERLOG",
  "INTERVAL_MASTERLOG_DELETED",
  "INTERVAL_FAILED_PROCESS_DATA",
];

// بررسی متغیرهای ضروری
const missingVariables = requiredEnvVariables.filter(
  (variable) => !process.env[variable]
);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVariables.join(", ")}`
  );
}

// استخراج متغیرهای محیطی
const {
  DATABASE_HOST,
  DATABASE_NAME,
  DATABASE_USERNAME,
  DATABASE_PASSWORD,
  DATABASE_INSTANCE,
  LOCAL_FASTIFY_PROTOCOL,
  LOCAL_FASTIFY_HOST,
  LOCAL_FASTIFY_PORT,
  LOCAL_API_USERNAME,
  LOCAL_API_PASSWORD,
  DESTINATION_FASTIFY_PROTOCOL,
  DESTINATION_FASTIFY_HOST,
  DESTINATION_FASTIFY_PORT,
  DESTINATION_API_USERNAME,
  DESTINATION_API_PASSWORD,
  BATCH_SIZE_COMMENTS,
  BATCH_SIZE_COMMENTS_DELETED,
  BATCH_SIZE_MASTERLOG,
  BATCH_SIZE_MASTERLOG_DELETED,
  BATCH_SIZE_FAILED_PROCESS_DATA,
  INTERVAL_TOKEN_LOCAL,
  INTERVAL_TOKEN_DESTINATION,
  INTERVAL_CONTROLLER,
  INTERVAL_COMMENTS,
  INTERVAL_COMMENTS_DELETED,
  INTERVAL_MASTERLOG,
  INTERVAL_MASTERLOG_DELETED,
  INTERVAL_FAILED_PROCESS_DATA,
  TRANSFER,
  TRANSFER_COMMENTS,
  TRANSFER_COMMENTS_DELETED,
  TRANSFER_MASTERLOG,
  TRANSFER_MASTERLOG_DELETED,
  TRANSFER_FAILED_PROCESS_DATA,
  TRANSFER_ONLINE_PROCESS_DATA,
} = process.env;

// پیکربندی آدرس‌های محلی و مقصد
const hostLocal = `${LOCAL_FASTIFY_PROTOCOL}://${LOCAL_FASTIFY_HOST}:${LOCAL_FASTIFY_PORT}`;
const hostDestination = `${DESTINATION_FASTIFY_PROTOCOL}://${DESTINATION_FASTIFY_HOST}:${DESTINATION_FASTIFY_PORT}`;

// تنظیمات پایگاه داده
const sqlConfig = {
  user: DATABASE_USERNAME,
  password: DATABASE_PASSWORD,
  database: DATABASE_NAME,
  server: DATABASE_HOST,
  options: {
    encrypt: false,
    ssl: false,
    instanceName: DATABASE_INSTANCE,
    trustServerCertificate: false,
  },
};

// ماژول خروجی
module.exports = {
  DATABASE_HOST,
  DATABASE_NAME,
  DATABASE_USERNAME,
  DATABASE_PASSWORD,
  DATABASE_INSTANCE,
  LOCAL_FASTIFY_PROTOCOL,
  LOCAL_FASTIFY_HOST,
  LOCAL_FASTIFY_PORT,
  LOCAL_API_USERNAME,
  LOCAL_API_PASSWORD,
  DESTINATION_FASTIFY_PROTOCOL,
  DESTINATION_FASTIFY_HOST,
  DESTINATION_FASTIFY_PORT,
  DESTINATION_API_USERNAME,
  DESTINATION_API_PASSWORD,
  BATCH_SIZE_COMMENTS: Number(BATCH_SIZE_COMMENTS),
  BATCH_SIZE_COMMENTS_DELETED: Number(BATCH_SIZE_COMMENTS_DELETED),
  BATCH_SIZE_MASTERLOG: Number(BATCH_SIZE_MASTERLOG),
  BATCH_SIZE_MASTERLOG_DELETED: Number(BATCH_SIZE_MASTERLOG_DELETED),
  BATCH_SIZE_FAILED_PROCESS_DATA: Number(BATCH_SIZE_FAILED_PROCESS_DATA),
  INTERVAL_TOKEN_LOCAL: Number(INTERVAL_TOKEN_LOCAL),
  INTERVAL_TOKEN_DESTINATION: Number(INTERVAL_TOKEN_DESTINATION),
  INTERVAL_CONTROLLER: Number(INTERVAL_CONTROLLER),
  INTERVAL_COMMENTS: Number(INTERVAL_COMMENTS),
  INTERVAL_COMMENTS_DELETED: Number(INTERVAL_COMMENTS_DELETED),
  INTERVAL_FAILED_PROCESS_DATA: Number(INTERVAL_FAILED_PROCESS_DATA),
  INTERVAL_MASTERLOG: Number(INTERVAL_MASTERLOG),
  INTERVAL_MASTERLOG_DELETED: Number(INTERVAL_MASTERLOG_DELETED),
  TRANSFER: Boolean(TRANSFER),
  TRANSFER_COMMENTS: Boolean(TRANSFER_COMMENTS),
  TRANSFER_COMMENTS_DELETED: Boolean(TRANSFER_COMMENTS_DELETED),
  TRANSFER_MASTERLOG: Boolean(TRANSFER_MASTERLOG),
  TRANSFER_MASTERLOG_DELETED: Boolean(TRANSFER_MASTERLOG_DELETED),
  TRANSFER_FAILED_PROCESS_DATA: Boolean(TRANSFER_FAILED_PROCESS_DATA),
  TRANSFER_ONLINE_PROCESS_DATA: Boolean(TRANSFER_ONLINE_PROCESS_DATA),
  hostLocal,
  hostDestination,
  sqlConfig,
};

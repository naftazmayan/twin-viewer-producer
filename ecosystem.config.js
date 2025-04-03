module.exports = {
  apps: [
    {
      name: "twin-viewer-producer",
      script: "./index.js 28",
      env: {
        NODE_ENV: "production",
        ENV_PATH: "./.env",
      },
      watch: false,
      ignore_watch: ["node_modules", "logs"], // جلوگیری از نظارت روی این پوشه‌ها
      autorestart: true, // ری‌استارت خودکار در صورت کرش
      instances: 1, // تعداد پردازش‌ها (۱ = سینگل پروسس، "max" = تمام هسته‌ها)
      exec_mode: "fork", // اجرای عادی (می‌توانی به cluster تغییر دهی)
    },
  ],
};

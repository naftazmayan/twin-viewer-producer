const { compressData } = require("./helper");
const { Orm } = require("./orm");
const config = require("./config");
const { getLastCommentId, getLastCommentDeletedId } = require("./socket");

class TransferService {
  constructor(databaseService, wellId, socket) {
    if (!databaseService || !wellId) {
      throw new Error("Database service and wellId are required.");
    }

    this.orm = new Orm(databaseService, wellId);
    this.socket = socket || null;
    this.wellId = wellId;

    // Batch sizes from config
    this.batchSizes = {
      comments: config.BATCH_SIZE_COMMENTS,
      commentsDeleted: config.BATCH_SIZE_COMMENTS_DELETED,
      masterLog: config.BATCH_SIZE_MASTERLOG,
      masterLogDeleted: config.BATCH_SIZE_MASTERLOG_DELETED,
      failedProcessData: config.BATCH_SIZE_FAILED_PROCESS_DATA,
    };
  }

  setSocket(socket) {
    this.socket = socket;
  }

  async sendBatchData({
    fetchData,
    batchSize,
    event,
    ackCallback,
    delay = config.BATCH_DELAY_MS,
  }) {
    try {
      const data = await fetchData();

      if (!data || data.length === 0) {
        console.log(`# [Transfer] [${event}] No data to transfer.`);
        return;
      }

      const totalBatches = Math.ceil(data.length / batchSize);
      console.log(`# [Transfer] [${event}] Total batches: ${totalBatches}`);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, data.length);
        const batch = data.slice(start, end);

        const compressedData = await compressData(batch);

        await new Promise((resolve, reject) => {
          this.socket.emit(event, this.wellId, compressedData, (ack) => {
            if (ackCallback) ackCallback(ack, batch);
            if (ack && ack.success) {
              resolve();
            } else {
              reject(new Error(`Failed to transfer batch ${batchIndex + 1}`));
            }
          });
        });

        console.log(`# [Transfer] [${event}] Batch ${batchIndex + 1} sent.`);
        if (batchIndex < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      console.log(`# [Transfer] [${event}] All batches processed.`);
    } catch (error) {
      console.error(`# [Transfer] [${event}] Error:`, error);
    }
  }

  async sendWell() {
    try {
      const wellInfo = await this.orm.getWellById();
      if (!wellInfo) {
        console.error(
          `# [Transfer] [well] Well not found for wellId: ${this.wellId}`
        );
        return;
      }

      this.socket.emit("producer-well", wellInfo);

      if (wellInfo.WellParentId) {
        const wellParentInfo = await this.orm.getWellById(
          wellInfo.WellParentId
        );
        if (wellParentInfo) {
          this.socket.emit("producer-well", {
            ...wellParentInfo,
            socketIsConnected: true,
          });
        } else {
          console.warn(
            `# [Transfer] [well] Parent well not found for parentId: ${wellInfo.WellParentId}`
          );
        }
      }

      console.log(`# [Transfer] [well] Well data transfer completed.`);
    } catch (error) {
      console.error(`# [Transfer] [well] Error in sendWell:`, error);
    }
  }

  async sendProcessData(data) {
    if (this.socket && this.socket.connected) {
      const compressedData = await compressData(data);
      this.socket.emit(
        "producer-processData",
        this.wellId,
        compressedData,
        (ack) => {
          if (!ack.success) {
            this.orm.saveFailedData(
              data.code,
              data.dater,
              config.hostDestination
            );
          }
        }
      );
    } else {
      this.orm.saveFailedData(data.code, data.dater, config.hostDestination);
    }
  }

  async sendMasterLogs(lastMasterLogId) {
    await this.sendBatchData({
      fetchData: () => this.orm.getMasterLogs(lastMasterLogId),
      batchSize: this.batchSizes.masterLog,
      event: "producer-masterlog",
    });
  }

  async sendFailedData() {
    try {
      const failedDataCount = await this.orm.getFailedDataCount(
        config.hostDestination
      );

      if (failedDataCount === 0) {
        console.log("# [Resend] No failed data to resend.");
        return;
      }

      console.log(`# [Resend] Found ${failedDataCount} failed data to resend.`);
      const totalPages = Math.ceil(
        failedDataCount / this.batchSizeFailedProcessData
      );

      const pagesQueue = Array.from(
        { length: totalPages },
        (_, index) => index
      );
      const processQueue = async () => {
        if (pagesQueue.length === 0) return; // صف خالی است، همه داده‌ها پردازش شده‌اند.

        const currentPage = pagesQueue.shift();

        // دریافت داده‌های ناموفق برای این صفحه
        const failedDataBatch = await this.orm.getFailedDataBatch(
          config.hostDestination,
          currentPage * this.batchSizeFailedProcessData,
          this.batchSizeFailedProcessData
        );

        if (!failedDataBatch.length) {
          console.log(`# [Resend] Page ${currentPage} is empty.`);
          return processQueue(); // پردازش صفحه بعدی
        }

        // فشرده‌سازی داده‌ها
        const compressedData = await compressData(failedDataBatch);

        // ارسال داده‌ها به سوکت
        await new Promise((resolve, reject) => {
          this.socket.emit(
            "producer-processData-batch",
            this.wellId,
            compressedData,
            async (ack) => {
              if (ack && ack.success) {
                await this.orm.deleteFailedDataBatch(
                  config.hostDestination,
                  failedDataBatch
                );
                resolve();
              } else {
                reject(
                  new Error(`Failed to resend batch for page ${currentPage}.`)
                );
              }
            }
          );
        });

        console.log(`# [Resend] Page ${currentPage} processed.`);

        // برای اعمال محدودیت درخواست‌ها (۲ درخواست در هر ثانیه)
        if (pagesQueue.length > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, config.BATCH_DELAY_MS)
          ); // تاخیر ۵۰۰ میلی‌ثانیه
        }

        processQueue(); // پردازش ادامه‌دار
      };

      processQueue();
    } catch (error) {
      console.error("Error in sendFailedData:", error);
    }
  }

  async sendComments() {
    const lastCommentId = await getLastCommentId(this.socket, this.wellId);
    await this.sendBatchData({
      fetchData: () => this.orm.getComments(lastCommentId),
      batchSize: this.batchSizes.comments,
      event: "producer-comments",
    });
  }

  async sendCommentsDeleted() {
    const lastCommentDeletedId = await getLastCommentDeletedId(
      this.socket,
      this.wellId
    );
    await this.sendBatchData({
      fetchData: () => this.orm.getCommentsDeleted(lastCommentDeletedId),
      batchSize: this.batchSizes.commentsDeleted,
      event: "producer-comments-deleted",
    });
  }

  async sendMasterLogsDeleted(lastMasterLogId) {
    await this.sendBatchData({
      fetchData: () => this.orm.getMasterLogsForTransfer(lastMasterLogId),
      batchSize: this.batchSizes.masterLogDeleted,
      event: "producer-masterLogs-deleted",
    });
  }
}

module.exports = { TransferService };

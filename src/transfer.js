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
    this.socket = socket || null; // سوکت اولیه
    this.wellId = wellId;

    // Batch sizes from config
    this.batchSizeComments = config.BATCH_SIZE_COMMENTS;
    this.batchSizeCommentsDeleted = config.BATCH_SIZE_COMMENTS_DELETED;
    this.batchSizeMasterLog = config.BATCH_SIZE_MASTERLOG;
    this.batchSizeMasterLogDeleted = config.BATCH_SIZE_MASTERLOG_DELETED;
    this.batchSizeFailedProcessData = config.BATCH_SIZE_FAILED_PROCESS_DATA;
  }

  setSocket(socket) {
    this.socket = socket;
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

      for (let currentPage = 0; currentPage <= totalPages; currentPage++) {
        const failedDataBatch = await this.orm.getFailedDataBatch(
          config.hostDestination,
          currentPage * this.batchSizeFailedProcessData,
          this.batchSizeFailedProcessData
        );
        if (!failedDataBatch.length) continue;

        const compressedData = await compressData(failedDataBatch);

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
                reject(new Error("Failed to resend batch."));
              }
            }
          );
        });
      }
    } catch (error) {
      console.error("Error in sendFailedData:", error);
    }
  }

  async sendWell() {
    try {
      // دریافت اطلاعات چاه
      const wellInfo = await this.orm.getWellById();
      if (!wellInfo) {
        console.error(
          `# [Transfer] [well] Error: Well not found for wellId: ${this.wellId}`
        );
        return;
      }

      // ارسال اطلاعات چاه
      this.socket.emit("producer-well", wellInfo);

      // ارسال اطلاعات والد در صورت وجود
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

      console.log(`# [Transfer] [well] End - Well data transfer completed.`);
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
        config.TRANSFER_ONLINE_PROCESS_DATA_SAVE,
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
      if (data)
        this.orm.saveFailedData(data.code, data.dater, config.hostDestination);
    }
  }

  async sendMasterLogs(lastMasterLogId) {
    try {
      const masterLogs = await this.orm.getMasterLogs(0);

      if (!masterLogs || masterLogs.length === 0) {
        console.log("# [Transfer] [masterLogs] No master logs to transfer.");
        return;
      }

      const totalBatches = Math.ceil(
        masterLogs.length / this.batchSizeMasterLog
      );
      console.log(
        `# [Transfer] [masterLogs] Total batches to transfer: ${totalBatches}`
      );

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * this.batchSizeMasterLog;
        const end = Math.min(
          start + this.batchSizeMasterLog,
          masterLogs.length
        );
        const batch = masterLogs.slice(start, end);

        const compressedData = await compressData(batch);

        this.socket.emit("producer-masterlog", this.wellId, compressedData);
      }

      console.log(
        "# [Transfer] [masterLogs] All master logs transferred successfully."
      );
    } catch (error) {
      console.error("# [Transfer] [masterLogs] Error:", error);
    }
  }

  async sendComments() {
    try {
      const lastCommentId = await getLastCommentId(this.socket, this.wellId);

      const comments = await this.orm.getComments(lastCommentId);

      if (!comments || comments.length === 0) {
        console.log(`# [Transfer] [comments] No comments to transfer.`);
        return;
      }

      const totalBatches = Math.ceil(comments.length / this.batchSizeComments);
      console.log(
        `# [Transfer] [comments] Total batches to transfer: ${totalBatches}`
      );

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * this.batchSizeComments;
        const end = Math.min(start + this.batchSizeComments, comments.length);
        const batch = comments.slice(start, end);

        const compressedData = await compressData(batch);

        try {
          await new Promise((resolve, reject) => {
            this.socket.emit(
              "producer-comments",
              this.wellId,
              compressedData,
              (ack) => {
                if (ack && ack.success) {
                  resolve();
                } else {
                  reject(new Error("Failed to transfer batch."));
                }
              }
            );
          });
        } catch (err) {
          console.error(
            `# [Transfer] [comments] Error in transferring batch ${
              batchIndex + 1
            }:`,
            err
          );
          throw err; // Throwing error to exit the loop
        }
      }
    } catch (error) {
      console.error(`# [Transfer] [comments] Error:`, error);
      // می‌توانید خطا را ارسال کنید یا به سیستم دیگری ذخیره کنید
    }
  }

  async sendCommentsDeleted() {
    try {
      const lastId = await getLastCommentDeletedId(this.socket, this.wellId);

      const deletedComments = await this.orm.getCommentsDeleted(lastId);

      if (!deletedComments || deletedComments.length === 0) {
        console.log(
          `# [Transfer] [comments-deleted] No deleted comments to transfer.`
        );
        return;
      }

      const totalBatches = Math.ceil(
        deletedComments.length / this.batchSizeCommentsDeleted
      );
      console.log(
        `# [Transfer] [comments-deleted] Total batches to transfer: ${totalBatches}`
      );

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * this.batchSizeCommentsDeleted;
        const end = Math.min(
          start + this.batchSizeCommentsDeleted,
          deletedComments.length
        );
        const batch = deletedComments.slice(start, end);

        const compressedData = await compressData(batch);

        // انتقال داده‌ها از طریق سوکت
        this.socket.emit(
          "producer-comments-deleted",
          this.wellId,
          compressedData
        );

        // ادامه دادن به Batch بعدی
      }

      console.log(`# [Transfer] [comments-deleted] All batches processed.`);
    } catch (error) {
      console.error(
        `# [Transfer] [comments-deleted] Error during transfer:`,
        error
      );
    }
  }

  async sendMasterLogsDeleted(lastMasterLogId) {
    try {
      const masterLogsDeleted = await this.orm.getMasterLogsForTransfer(
        lastMasterLogId
      );

      if (!masterLogsDeleted || masterLogsDeleted.length === 0) return;

      const totalBatches = Math.ceil(
        masterLogsDeleted.length / this.batchSizeMasterLogDeleted
      );

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * this.batchSizeMasterLogDeleted;
        const end = Math.min(
          start + this.batchSizeMasterLogDeleted,
          masterLogsDeleted.length
        );
        const batch = masterLogsDeleted.slice(start, end);

        const compressedData = await compressData(batch);
        await new Promise((resolve, reject) => {
          this.socket.emit(
            "producer-masterLogs-deleted",
            this.wellId,
            compressedData,
            (ack) => {
              if (ack && ack.success) {
                resolve();
              } else {
                reject();
              }
            }
          );
        });
      }

      console.log("# [Transfer] MasterLogs Deleted transferred successfully.");
    } catch (error) {
      console.error("Error in sendMasterLogsDeleted:", error);
    }
  }
}

module.exports = { TransferService };

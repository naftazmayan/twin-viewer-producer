const sql = require("mssql");

class DatabaseService {
  constructor(pool) {
    if (!pool) {
      throw new Error("A valid SQL connection pool is required.");
    }
    this.pool = pool;
  }

  async executeProcedure(procedureName, inputs = {}, outputs = {}) {
    try {
      const request = this.pool.request();

      for (const [key, value] of Object.entries(inputs)) {
        request.input(key, value);
      }
          for (const [key, type] of Object.entries(outputs)) {

        request.output(key, type);
      }

      const result = await request.execute(procedureName);
      return result;
    } catch (error) {
      console.error(`Error executing procedure ${procedureName}:`, error);
      throw error;
    }
  }

  async fetchRecords(procedureName, inputs = {}, outputs = {}) {
    const result = await this.executeProcedure(procedureName, inputs, outputs);
    return result.recordset || [];
  }

  async fetchSingleRecord(procedureName, inputs = {}, outputs = {}) {
    const records = await this.fetchRecords(procedureName, inputs, outputs);
    return records[0] || null;
  }
}

class Orm {
  constructor(databaseService, wellId) {
    if (!wellId) {
      throw new Error("wellId is required.");
    }
    this.db = databaseService;
    this.wellId = wellId;
  }

async saveFailedData(code, dateR, uri) {
  await this.db.executeProcedure(
    "OnLine_Failed_ProcessData_SaveDynamic_ByCode",
    {
      code,
      Wellid: this.wellId,
      DateR: dateR,
      ServerInfo: uri,
      IsMasterLog: 0,
    },
    {
      ErrorCode: sql.Int,
      ErrorDesc: sql.NVarChar,
    }
  );
}

  async getWellById(wellId = this.wellId) {
    return this.db.fetchSingleRecord("OnLine_WellInfo_GetByID", {
      CallerUserId: 0,
      WellID: wellId,
    });
  }

  async getFailedDataCount(serverInfo) {
    const result = await this.db.executeProcedure(
      "OnLine_Failed_ProcessData_GetCount",
      {
        Wellid: this.wellId,
        IsMasterLog: 0,
        ServerInfo: serverInfo
      },
      {
        ErrorCode: sql.Int,
        ErrorDesc: sql.NVarChar,
      }
    );
    return result.recordset[0]?.TotalRec || 0;
  }

  async getFailedDataBatch(serverInfo, startPage, pageSize) {
    return this.db.fetchRecords("OnLine_Failed_ProcessData_GetBatch_Col", {
      Wellid: this.wellId,
      IsMasterLog: 0,
      ServerInfo: serverInfo,
      StartPage: startPage,
      PageSize: pageSize,
    }, {
      ErrorCode: sql.Int,
        ErrorDesc: sql.NVarChar,
    });
  }

  async deleteFailedDataBatch(serverInfo, dataList) {
    const processDataList = new sql.Table("ProcessData_Type");
    processDataList.columns.add("PName", sql.NVarChar);
    processDataList.columns.add("PVal", sql.NVarChar);

    dataList.forEach((data) => {
      processDataList.rows.add("", String(data.Code));
    });

    await this.db.executeProcedure(
      "OnLine_Failed_ProcessData_Delete",
      {
        Wellid: this.wellId,
        IsMasterLog: 0,
        ServerInfo: serverInfo,
        ProcessDataList: processDataList,
      },
      {
        ErrorCode: sql.Int,
        ErrorDesc: sql.NVarChar,
      }
    );
  }

  async saveFailedData(code, dateR, serverInfo, isMasterLog) {
    await this.db.executeProcedure(
      "OnLine_Failed_ProcessData_SaveDynamic_ByCode",
      {
        wellid: this.wellId,
        code,
        DateR: dateR,
        ServerInfo: serverInfo,
        IsMasterLog: isMasterLog,
      }, {
        ErrorCode: sql.Int,
        ErrorDesc: sql.NVarChar,
      }
    );
  }

  async getLastProcessData(lastCode = 0) {
    return this.db.fetchSingleRecord("ProcessData_Get_Online_Front", {
      code: lastCode,
      wellId: this.wellId,
    });
  }

  async getMasterLogs(lastCode) {
    return this.db.fetchRecords("OnLine_MasterLog_GetAll_ById", {
      Code: lastCode,
      Wellid: this.wellId,
    }, {
        ErrorCode: sql.Int,
        ErrorDesc: sql.NVarChar,
      });
  }

  async getComments(lastId) {
  return this.db.fetchRecords(
    "OnLine_Comment_GetAll_ById",
    {
      Id: lastId,
      Code: null,
      Wellid: this.wellId,
    },
    {
      ErrorCode: sql.Int, // افزودن پارامتر خروجی
      ErrorDesc: sql.NVarChar, // اگر `ErrorDesc` نیز انتظار می‌رود
    }
  );
  }

  async getCommentsDeleted(lastId) {
    const result = await this.db.fetchRecords(
   "OnLine_Comment_DeleteLog_GetAll_ById",
    {
      Wellid: this.wellId,
      Id: lastId,
    },
    {
      ErrorCode: sql.Int, // افزودن پارامتر خروجی
      ErrorDesc: sql.NVarChar, // اگر `ErrorDesc` نیز انتظار می‌رود
    }
  );
  return result.map(i => i.id)
  }

}

module.exports = { DatabaseService, Orm };

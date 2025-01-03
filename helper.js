const zlib = require("zlib");

function compressData(data) {
  return new Promise((resolve, reject) => {
    zlib.brotliCompress(Buffer.from(JSON.stringify(data)), (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

module.exports = {
  compressData,
};

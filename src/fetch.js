const { INTERVAL_DESTINATION_HEALTH } = require("./config");

const getToken = async (authServerUrl, username, password) => {
  try {
    const url = new URL("/api/v1/auth/login", authServerUrl);
    const authResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      console.error(
        `Error: ${authResponse.status} - ${authResponse.statusText}`
      );
      return null;
    }

    const responseData = await authResponse.json();

    if (responseData.success && responseData.data && responseData.data.token) {
      return responseData.data.token;
    } else {
      console.error("Authentication failed: Invalid response structure");
      return null;
    }
  } catch (error) {
    throw error;
  }
};

function getTokenWithRetry(serverAddress, username, password, interval) {
  return new Promise((resolve, reject) => {
    const intervalId = setInterval(async () => {
      try {
        const token = await getToken(serverAddress, username, password);

        clearInterval(intervalId); // توقف تلاش‌ها
        resolve(token); // برگرداندن توکن در صورت موفقیت
      } catch (error) {
        console.error(
          `# [${serverAddress}] Failed to fetch token. Retrying...`
        );
      }
    }, interval);
  });
}

module.exports = {
  getToken,
  getTokenWithRetry,
};

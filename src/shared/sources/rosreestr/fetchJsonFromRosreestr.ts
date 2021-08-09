import axios, { AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import FormData from "form-data";
import https from "https";

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
});

axiosRetry(axiosInstance, {
  retries: 30,
  retryDelay: (retryCount) =>
    (retryCount - 1) * 500 +
    Math.max(retryCount - 3, 0) * (retryCount - 3) * 1000 * 5, // long retry mode after 10 attempts in case of request throttling
  retryCondition: (error) =>
    ![200, 204, 404].includes(error.response?.status ?? 0),
  shouldResetTimeout: true,
});

export const fetchJsonFromRosreestr = async <T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<AxiosResponse<T>> => {
  const formData = new FormData();
  // console.log(params);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    formData.append(key, `${value}`);
  });

  const result = await axiosInstance.post<T>(url, formData, {
    responseType: "json",
    timeout: 5000,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
      referer: "https://pkk.rosreestr.ru/",
      origin: "https://pkk.rosreestr.ru",
      ...formData.getHeaders(),
    },
  });

  formData.destroy();

  // console.log("HHHH", result.request, "BBBB", result.request?.body);

  // console.log(result);

  return result;
};

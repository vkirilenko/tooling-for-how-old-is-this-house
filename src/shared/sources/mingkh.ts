import chalk from "chalk";
import fs from "fs-extra";
import path from "path";

import { getRegionConfig, getRegionDirPath } from "../region";

export interface HouseListResponse {
  current: number;
  rowCount: number;
  rows: Array<{
    rownumber: string;
    address: string;
    square: string;
    year: string;
    floors: string;
    url: string;
    managerstartdate: string;
  }>;
}

export interface HouseListFile {
  fetchedAt: string;
  response: HouseListResponse;
}

export interface HouseInfo {
  address?: string;
  cadastralId?: string;
  centerPoint?: [lon: number, lat: number];
  id: number;
  numberOfFloors?: number;
  numberOfLivingQuarters?: number;
  year?: number;
}

export interface HouseInfoFile {
  fetchedAt: string;
  parsedAt: string;
  data: HouseInfo;
}

export const getHouseListFilePath = (
  mingkhRegionUrl: string,
  mingkhCityUrl: string,
) => {
  return path.resolve(
    getRegionDirPath(),
    "sources",
    "migkh",
    "house-lists",
    `${mingkhRegionUrl}--${mingkhCityUrl}.json`,
  );
};

export const getHouseListGeoJsonFilePath = () => {
  return path.resolve(
    getRegionDirPath(),
    "sources",
    "migkh",
    "house-list.geojson",
  );
};

export const deriveHouseFilePath = (
  houseId: number,
  fileNameSuffix: string,
) => {
  const normalisedHouseId = `${houseId}`.padStart(7, "0");

  return path.resolve(
    getRegionDirPath(),
    "sources",
    "migkh",
    "houses",
    `${normalisedHouseId.substring(0, 4)}xxx`,
    `${normalisedHouseId}--${fileNameSuffix}`,
  );
};

export const loopThroughHouseLists = async (
  callback: (payload: {
    regionUrl: string;
    cityUrl: string;
    houseListFilePath: string;
  }) => Promise<void>,
) => {
  const regionConfig = await getRegionConfig();
  const houseListsToFetch = regionConfig.sources?.mingkh?.houseLists ?? [];

  for (const houseListConfig of houseListsToFetch) {
    process.stdout.write(
      `  ${houseListsToFetch.indexOf(houseListConfig) + 1}/${
        houseListsToFetch.length
      }:`,
    );

    const { regionUrl, cityUrl } = houseListConfig || {};
    if (!regionUrl || !cityUrl) {
      process.stdout.write(chalk.red(" Skipping due to misconfig.\n"));
      continue;
    }

    const houseListFilePath = getHouseListFilePath(regionUrl, cityUrl);

    try {
      await callback({ regionUrl, cityUrl, houseListFilePath });
    } catch (e) {
      process.stdout.write(chalk.red(` Error: ${e}\n`));
    }
  }
};

/**
 * @param houseUrl e.g. /penzenskaya-oblast/penza/977878
 * @returns e.g. 977878
 */
const extractHouseIdFromUrl = (houseUrl: string): number => {
  const result = houseUrl.split("/")[3];
  if (!result) {
    throw new Error(`Cannot extract house id from url ${houseUrl}`);
  }

  return parseInt(result);
};

export const loopThroughRowsInHouseList = async (
  houseListFilePath: string,
  callback: (payload: { houseId: number; houseUrl: string }) => Promise<void>,
) => {
  const houseList: HouseListFile = await fs.readJson(houseListFilePath);

  const rows = houseList.response.rows;
  const numberOfRows = rows.length;
  const numberOfRowsCharCount = `${numberOfRows}`.length;

  process.stdout.write(
    ` Found ${rows.length} houses in ${houseListFilePath}\n`,
  );

  for (const row of rows) {
    const humanFriendlyIndex = `${rows.indexOf(row) + 1}`.padStart(
      numberOfRowsCharCount,
      "0",
    );
    process.stdout.write(`    ${humanFriendlyIndex}/${numberOfRows}:`);
    try {
      const houseId = extractHouseIdFromUrl(row.url);
      await callback({ houseId, houseUrl: row.url });
    } catch (e) {
      process.stdout.write(chalk.red(` Error: ${e}\n`));
    }
  }
};

export const notFilledIn = ["Не заполнено", "Нет данных"];

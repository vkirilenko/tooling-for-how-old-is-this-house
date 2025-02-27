import * as tilebelt from "@mapbox/tilebelt";
import * as turf from "@turf/turf";
import fs from "fs-extra";
import sortKeys from "sort-keys";

import { addBufferToBbox } from "../../helpersForGeometry";
import { serializeTime, writeFormattedJson } from "../../helpersForJson";
import { ProcessTile, TileStatus } from "../../tiles";
import { fetchJsonFromRosreestr } from "./fetchJsonFromRosreestr";
import {
  compressRosreestrCenter,
  compressRosreestrExtent,
} from "./helpersForApiResponses";
import { getTileDataFilePath } from "./helpersForPaths";
import { pauseBetweenPkkApiRequestsToAvoid403 } from "./pauseBetweenPkkApiRequestsToAvoid403";
import {
  RawRosreestrTileResponse,
  RosreestrObjectType,
  RosreestrTileData,
  RosreestrTileResponse,
} from "./types";

// The API may return fewer items than requested even if not all of them fit the first page.
// This might be due to item deduplication that happens when the result is prepared.
// Judging tile completion with some tolerance helps to not miss the data.

const maxSupportedFeaturesPerTileRequest = 40;
const tileCompletionTolerance = 2;

const featureNumericIdLookup: Record<RosreestrObjectType, number> = {
  cco: 5,
  lot: 1,
};

export const deriveRosreestrTileDataStatus = (
  tileData: RosreestrTileData,
): TileStatus => {
  const numberOfFeatures = tileData.response.features.length;
  if (numberOfFeatures > maxSupportedFeaturesPerTileRequest) {
    throw new Error(`Unexpected number of features ${numberOfFeatures}`);
  }

  return numberOfFeatures >=
    maxSupportedFeaturesPerTileRequest - tileCompletionTolerance
    ? "needsSplitting"
    : "complete";
};

const generateRosreestrTileComment = (
  tileDataFilePath: string,
  tileData: RosreestrTileData,
): string => {
  const numberOfFeatures = tileData?.response?.features?.length;
  const numberOfFeaturesAsString = `${numberOfFeatures ?? "?"}`;

  return `${tileDataFilePath} ${numberOfFeaturesAsString.padStart(2)}`;
};

const getTileBufferInMeters = (zoom: number): number => {
  if (zoom < 17) {
    return 10;
  }
  if (zoom < 19) {
    return 5;
  }
  if (zoom === 19) {
    return 2;
  }
  if (zoom === 20) {
    return 1;
  }

  return 0;
};

export const generateProcessTile = (
  objectType: RosreestrObjectType,
): ProcessTile => async (tile) => {
  const tileDataFilePath = getTileDataFilePath(objectType, tile);

  try {
    const cachedTileData = (await fs.readJson(
      tileDataFilePath,
    )) as RosreestrTileData;

    return {
      cacheStatus: "used",
      tileStatus: deriveRosreestrTileDataStatus(cachedTileData),
      comment: generateRosreestrTileComment(tileDataFilePath, cachedTileData),
    };
  } catch {
    // noop – proceeding with actual fetching
  }

  const tileExtentGeometry = turf.bboxPolygon(
    addBufferToBbox(
      tilebelt.tileToBBOX(tile) as turf.BBox,
      getTileBufferInMeters(tile[2]),
    ),
  ).geometry;

  if (!tileExtentGeometry) {
    throw new Error("Unexpected empty geometry");
  }

  const rawTileResponse = (
    await fetchJsonFromRosreestr<RawRosreestrTileResponse>(
      `https://pkk.rosreestr.ru/api/features/${featureNumericIdLookup[objectType]}`,
      {
        sq: JSON.stringify(tileExtentGeometry),
        tolerance: 2, // Needs to be a power of two. The smaller the number, the fewer features outside the polygon are returned.
        limit: maxSupportedFeaturesPerTileRequest,
      },
    )
  ).data;

  await pauseBetweenPkkApiRequestsToAvoid403();

  const compressedTileResponse: RosreestrTileResponse = {
    ...rawTileResponse,
    features: rawTileResponse.features.map((feature) => {
      return {
        ...feature,
        center: compressRosreestrCenter(feature.center),
        extent: compressRosreestrExtent(feature.extent),
      };
    }),
  };

  const tileData: RosreestrTileData = {
    tile,
    fetchedAt: serializeTime(),
    fetchedExtent: tileExtentGeometry,
    response: sortKeys(compressedTileResponse, { deep: true }),
  };

  await writeFormattedJson(tileDataFilePath, tileData);

  return {
    cacheStatus: "notUsed",
    tileStatus: deriveRosreestrTileDataStatus(tileData),
    comment: generateRosreestrTileComment(tileDataFilePath, tileData),
  };
};

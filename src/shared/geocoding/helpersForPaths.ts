import path from "path";

import {
  buildCleanedAddressAst,
  buildStandardizedAddressAst,
  printStandardizedAddressSection,
  StandardizedAddressAst,
  StandardizedAddressAstSectionType,
} from "../addresses";
import { getTerritoryDirPath } from "../territory";

export const getGeocodeDictionariesDirPath = () => {
  return path.resolve(getTerritoryDirPath(), "geocoding");
};

export const getGeocodeDictionaryFileName = () => "dictionary.json";

export const getDictionaryFilePath = (sliceId: string) => {
  return path.resolve(
    getGeocodeDictionariesDirPath(),
    sliceId,
    getGeocodeDictionaryFileName(),
  );
};

const createStandardizedSlice = (
  standardizedAddressAst: StandardizedAddressAst,
  sectionType: StandardizedAddressAstSectionType,
): string | undefined => {
  const sectionNode = standardizedAddressAst.sectionLookup[sectionType];
  if (sectionNode) {
    printStandardizedAddressSection(sectionNode);
  }

  return undefined;
};

/**
 *
 * for cleaned address (CAPS):
 *   first letters of words that are not designations
 *   e.g. "село проверочное 1234, улица тестовая" → "cleaned", п-т
 *
 * for standardised address (lower case):
 *   "standardized", federal subject, settlement, street
 *
 * TODO: support villages
 *   federal subject, +district?, settlement, street
 */
export const deriveNormalizedAddressSliceId = (
  normalizedAddress: string,
): string => {
  const slices: Array<string | undefined> = [];
  const cleanedAddressAst = buildCleanedAddressAst(normalizedAddress);

  try {
    const standardizedAddressAst = buildStandardizedAddressAst(
      cleanedAddressAst,
    );
    slices.push("standardized");
    slices.push(createStandardizedSlice(standardizedAddressAst, "region"));
    slices.push(createStandardizedSlice(standardizedAddressAst, "settlement"));
    slices.push(
      createStandardizedSlice(standardizedAddressAst, "streetOrPlace"),
    );
  } catch {
    slices.push("cleaned");
    cleanedAddressAst.children.forEach((node) => {
      if (node.nodeType === "word" && node.wordType === "unclassified") {
        slices.push(node.value[0]);
      }
    });
  }

  return slices
    .filter((slice): slice is string => typeof slice === "string")
    .map((slice) => slice.replace(/\//g, ""))
    .join("/");
};

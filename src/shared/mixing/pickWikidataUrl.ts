import { prioritizeRelevantPropertyVariants } from "./prioritizeRelevantPropertyVariants";
import { PickFromPropertyVariants } from "./types";

export const pickWikidataUrl: PickFromPropertyVariants<
  "wikidataUrl" | "wikidataUrlSource"
> = ({ listRelevantPropertyVariants, logger, targetBuildArea }) => {
  const propertyVariants = prioritizeRelevantPropertyVariants({
    callingFilePath: __filename,
    listRelevantPropertyVariants,
    logger,
    prioritizedSources: ["manual", "wikidata", "wikivoyage", "osm"],
    propertySelectors: ["wikidataUrl"],
    targetBuildArea,
  });

  for (const propertyVariant of propertyVariants) {
    if (propertyVariant.wikidataUrl) {
      return {
        wikidataUrl: propertyVariant.wikidataUrl,
        wikidataUrlSource: propertyVariant.source,
      };
    }
  }

  return undefined;
};

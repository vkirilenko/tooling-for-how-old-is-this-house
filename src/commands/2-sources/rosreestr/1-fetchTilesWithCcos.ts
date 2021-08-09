import { autoStartCommandIfNeeded, Command } from "@kachkaev/commands";
import chalk from "chalk";

import { generateProcessTile } from "../../../shared/sources/rosreestr";
import { getTerritoryExtent } from "../../../shared/territory";
import { processTiles } from "../../../shared/tiles";

export const fetchTilesWithCcos: Command = async ({ logger }) => {
  logger.log(chalk.bold("sources/rosreestr: Fetching tiles with CCOs"));

  await processTiles({
    initialZoom: 14,
    maxAllowedZoom: 24,
    territoryExtent: await getTerritoryExtent(),
    processTile: generateProcessTile("cco"),
    logger,
  });
};

autoStartCommandIfNeeded(fetchTilesWithCcos, __filename);

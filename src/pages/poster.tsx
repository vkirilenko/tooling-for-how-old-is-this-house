import fs from "fs-extra";
import { GetStaticProps, NextPage } from "next";
import dynamic from "next/dynamic";
import * as React from "react";

import { getMixedPropertyVariantsFilePath } from "../shared/outputMixing";
import { readFetchedOsmFeatureCollection } from "../shared/sources/osm/readFetchedOsmFeatureCollection";
import { getPosterConfig, getTerritoryExtent } from "../shared/territory";
import { PosterProps } from "../ui/Poster";

const Poster = dynamic<PosterProps>(
  import("../ui/Poster").then((m) => m.Poster),
  { ssr: false },
);

type PosterPageProps = PosterProps;

const PosterPage: NextPage<PosterPageProps> = (props) => {
  return <Poster {...props} />;
};

// https://github.com/vercel/next.js/discussions/11209
const removeUndefinedForNextJsSerializing = <T,>(props: T): T =>
  Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined),
  ) as T;

export const getStaticProps: GetStaticProps<PosterPageProps> = async () => {
  return {
    props: removeUndefinedForNextJsSerializing({
      posterConfig: await getPosterConfig(),
      buildingCollection: await fs.readJson(getMixedPropertyVariantsFilePath()),
      territoryExtent: await getTerritoryExtent(),

      railwayCollection: await readFetchedOsmFeatureCollection("railways"),
      roadCollection: await readFetchedOsmFeatureCollection("roads"),
      waterObjectCollection: await readFetchedOsmFeatureCollection(
        "water-objects",
      ),
    }),
  };
};

export default PosterPage;

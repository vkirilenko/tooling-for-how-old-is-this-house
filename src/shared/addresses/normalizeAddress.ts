import { AddressInterpretationError } from "./AddressInterpretationError";
import { buildCleanedAddressAst } from "./buildCleanedAddressAst";
import { buildStandardizedAddressAst } from "./buildStandardizedAddressAst";
import { printCleanedAddressAst } from "./printCleanedAddressAst";
import { printStandardizedAddressAst } from "./printStandardizedAddressAst";
import {
  AddressNormalizationConfig,
  FinalizeWordSpelling,
  ReorderWordsInSection,
} from "./types";

export const normalizeAddress = (
  rawAddress: string | undefined,
  config: AddressNormalizationConfig,
  reorderWordsInSection?: ReorderWordsInSection,
  finalizeWordSpelling?: FinalizeWordSpelling,
): string | undefined => {
  if (!rawAddress || rawAddress.trim().length === 0) {
    return undefined;
  }

  const cleanedAddressAst = buildCleanedAddressAst(rawAddress);

  // Check for empty addresses (only separators, e.g. "-")
  if (!cleanedAddressAst.children.some((node) => node.nodeType === "word")) {
    return undefined;
  }

  try {
    const standardizedAddressAst = buildStandardizedAddressAst(
      cleanedAddressAst,
      config,
    );

    return printStandardizedAddressAst(
      standardizedAddressAst,
      reorderWordsInSection,
      finalizeWordSpelling,
    );
  } catch (e: unknown) {
    if (e instanceof AddressInterpretationError) {
      return printCleanedAddressAst(cleanedAddressAst, finalizeWordSpelling);
    }
    throw e;
  }
};

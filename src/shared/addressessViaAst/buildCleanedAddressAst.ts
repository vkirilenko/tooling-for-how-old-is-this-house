import { extractTokens } from "./extractTokens";
import {
  designationAdjectiveConfigLookup,
  isNormalizedDesignationAdjective,
} from "./helpersForDesignationAdjectives";
import { designationConfigLookup } from "./helpersForDesignations";
import { ordinalNumberEndingConfigLookup } from "./helpersForOrdinalNumbers";
import {
  AddressNodeWithDesignation,
  AddressNodeWithNumber,
  AddressNodeWithUnclassifiedWord,
  AddressNodeWithWord,
  AddressToken,
  AddressTokenType,
  CleanedAddressAst,
  CleanedAddressNode,
  DesignationConfig,
} from "./types";

const wordTokensSet = new Set<AddressTokenType>([
  "letterSequence",
  "numberSequence",
  "protoWord",
]);

const separatorTokensSet = new Set<AddressTokenType>([
  "bracket",
  "comma",
  "dash",
  "slash",
]);

const isUnclassifiedWord = (
  node?: CleanedAddressNode,
): node is AddressNodeWithUnclassifiedWord =>
  !!node && node.nodeType === "word" && node.wordType === "unclassified";

const isDesignation = (
  node?: CleanedAddressNode,
): node is AddressNodeWithDesignation =>
  !!node && node.nodeType === "word" && node.wordType === "designation";

const canBeInitial = (
  node?: CleanedAddressNode,
): node is AddressNodeWithUnclassifiedWord =>
  isUnclassifiedWord(node) &&
  (node.value.length === 1 ||
    (node.value.length === 2 && node.value[1] === "."));

const canHaveDesignationAdjective = (
  node?: CleanedAddressNode,
): node is AddressNodeWithUnclassifiedWord =>
  isUnclassifiedWord(node) && Boolean(node.value.match(/(ая|ый|ое|нка|вка)$/));

const findRelevantDesignation = (
  nodes: CleanedAddressNode[],
  node: CleanedAddressNode,
): DesignationConfig | undefined => {
  const nodeIndex = nodes.indexOf(node);

  // look left
  for (let index = nodeIndex - 1; index >= 0; index -= 1) {
    const nodeAtIndex = nodes[index]!;
    if (nodeAtIndex.nodeType === "separator") {
      break;
    }
    if (nodeAtIndex.wordType === "designation") {
      return designationConfigLookup[nodeAtIndex.value];
    }
  }

  // look right
  for (let index = nodeIndex + 1; index < nodes.length; index += 1) {
    const nodeAtIndex = nodes[index]!;
    if (nodeAtIndex.nodeType === "separator") {
      break;
    }
    if (nodeAtIndex.wordType === "designation") {
      return designationConfigLookup[nodeAtIndex.value];
    }
  }

  return undefined;
};

export const buildCleanedAddressAst = (
  rawAddress: string,
): CleanedAddressAst => {
  const tokens = extractTokens(rawAddress);

  // Filter tokens, combine and reduce the variety of separators
  const filteredTokens: AddressToken[] = [];
  for (const [tokenType, tokenValue] of tokens) {
    if (wordTokensSet.has(tokenType)) {
      filteredTokens.push([tokenType, tokenValue]);

      continue;
    }

    if (separatorTokensSet.has(tokenType)) {
      const lastFilteredToken = filteredTokens[filteredTokens.length - 1];

      // Combine separators
      if (lastFilteredToken && separatorTokensSet.has(lastFilteredToken[0])) {
        lastFilteredToken[0] = "comma";
        lastFilteredToken[1] = ",";

        continue;
      }

      // treat brackets as commas
      if ([tokenType, tokenValue][0] === "bracket") {
        filteredTokens.push(["comma", ","]);

        continue;
      }

      filteredTokens.push([tokenType, tokenValue]);
    }
  }

  // Trim separators
  while (filteredTokens[0] && separatorTokensSet.has(filteredTokens[0]![0])) {
    filteredTokens.shift();
  }
  while (
    filteredTokens[filteredTokens.length - 1] &&
    separatorTokensSet.has(filteredTokens[filteredTokens.length - 1]![0])
  ) {
    filteredTokens.pop();
  }

  // Generate initial nodes
  const nodes: CleanedAddressNode[] = [];
  for (const [tokenType, tokenValue] of filteredTokens) {
    if (wordTokensSet.has(tokenType)) {
      if (tokenType === "numberSequence") {
        nodes.push({
          nodeType: "word",
          wordType: "cardinalNumber",
          value: tokenValue,
          number: parseInt(tokenValue),
          ending: "",
        });
        continue;
      }

      nodes.push({
        nodeType: "word",
        wordType: "unclassified",
        value: tokenValue,
      });
      continue;
    }

    nodes.push({
      nodeType: "separator",
      separatorType:
        tokenType === "slash" || tokenType === "dash" ? tokenType : "comma",
    });
  }

  // Stitch [NN]-[WW] into a single token. Examples: '42 - А', "улица 30 - летия победы"
  for (let index = 0; index < nodes.length - 2; index += 1) {
    const node = nodes[index];
    if (
      !node ||
      node.nodeType !== "word" ||
      node.wordType !== "cardinalNumber"
    ) {
      continue;
    }

    const node2 = nodes[index + 1];
    if (
      !node2 ||
      node2.nodeType !== "separator" ||
      node2.separatorType !== "dash"
    ) {
      continue;
    }

    const node3 = nodes[index + 2];
    if (
      !node3 ||
      node3.nodeType !== "word" ||
      node3.wordType !== "unclassified" ||
      node3.value.match(/\d/)
    ) {
      continue;
    }

    nodes.splice(index, 3, {
      nodeType: "word",
      wordType: "unclassified",
      value: `${node.value}-${node3.value}`,
    });
  }

  // Find cardinal and ordinal numbers
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (node.nodeType !== "word" || node.wordType !== "unclassified") {
      continue;
    }
    const match = node.value.match(/^(\d+)([^.]*).?$/);
    if (!match) {
      continue;
    }
    const [, rawNumber = "", ending = ""] = match;
    const updatedNode = (node as AddressNodeWithWord) as AddressNodeWithNumber;
    updatedNode.number = parseInt(rawNumber);

    const ordinalNumberEndingConfig = ordinalNumberEndingConfigLookup[ending];
    // In a rare case, the address can finish with 42-Е, which is a cardinal number.
    // We only make the number ordinal if it is not the last one
    if (!nodes[index + 1]) {
      const endingWithoutDash = ending.startsWith("-")
        ? ending.slice(1)
        : ending;
      updatedNode.wordType = "cardinalNumber";
      updatedNode.value = `${rawNumber}${endingWithoutDash}`;
      updatedNode.ending = endingWithoutDash;
    } else if (ordinalNumberEndingConfig) {
      const normalizedEnding = ordinalNumberEndingConfig.normalizedValue;
      updatedNode.wordType = "ordinalNumber";
      updatedNode.value = `${rawNumber}${normalizedEnding}`;
      updatedNode.ending = normalizedEnding;
    } else {
      updatedNode.wordType = "cardinalNumber";
      updatedNode.value = `${rawNumber}${ending}`;
      updatedNode.ending = ending;
    }
  }

  // Detach endings from cardinal numbers in cases like ‘10корп’ (but not 10-летия)
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]!;
    if (node.nodeType !== "word" || node.wordType !== "cardinalNumber") {
      continue;
    }
    if (node.ending.length > 1 && node.ending[0] !== "-") {
      nodes.splice(index + 1, 0, {
        nodeType: "word",
        wordType: "unclassified",
        value: node.ending,
      });
      node.ending = "";
      node.value = `${node.number}`;
    }
  }

  // Attach ending to cardinal numbers ‘10 Б’
  for (let index = nodes.length - 2; index >= 0; index -= 1) {
    const node = nodes[index]!;
    if (
      node.nodeType !== "word" ||
      node.wordType !== "cardinalNumber" ||
      node.ending.length
    ) {
      continue;
    }

    const nextNode = nodes[index + 1]!;
    if (
      nextNode.nodeType !== "word" ||
      nextNode.wordType !== "unclassified" ||
      nextNode.value.length !== 1
    ) {
      continue;
    }

    const nextNode2 = nodes[index + 2];
    if (
      nextNode2 &&
      nextNode2.nodeType === "word" &&
      nextNode2.wordType === "cardinalNumber"
    ) {
      continue;
    }

    nodes.splice(index + 1, 1);
    node.value += nextNode.value;
    node.ending = nextNode.value;
  }

  // Convert dash into a comma if it is not between two cardinal numbers
  for (let index = 1; index < nodes.length - 1; index += 1) {
    const node = nodes[index]!;
    if (node.nodeType !== "separator" || node.separatorType !== "dash") {
      continue;
    }

    const prevNode = nodes[index - 1]!;
    const nextNode = nodes[index + 1]!;
    if (
      prevNode.nodeType !== "word" ||
      prevNode.wordType !== "cardinalNumber" ||
      nextNode.nodeType !== "word" ||
      nextNode.wordType !== "cardinalNumber"
    ) {
      node.separatorType = "comma";
    }
  }

  // Find initials (И. О.)
  for (let index = 0; index < nodes.length - 2; index += 1) {
    const node1 = nodes[index];
    const node2 = nodes[index + 1];
    const node3 = nodes[index + 2];

    if (
      canBeInitial(node1) &&
      canBeInitial(node2) &&
      isUnclassifiedWord(node3)
    ) {
      (node1 as AddressNodeWithWord).wordType = "initial";
      (node2 as AddressNodeWithWord).wordType = "initial";
      node1.value = `${node1.value[0]}.`;
      node2.value = `${node2.value[0]}.`;
    }
  }

  // Find designations
  for (let index = 0; index < nodes.length; index += 1) {
    const prevNode = nodes[index - 1];
    const node = nodes[index];
    if (!isUnclassifiedWord(node) || isDesignation(prevNode)) {
      continue;
    }

    const designationConfig = designationConfigLookup[node.value];
    if (!designationConfig) {
      continue;
    }
    const updatedNode = (node as AddressNodeWithWord) as AddressNodeWithDesignation;
    updatedNode.wordType = "designation";
    updatedNode.value = designationConfig.normalizedValue;
  }

  // Find single initials (И.)
  for (let index = 0; index < nodes.length - 3; index += 1) {
    const node1 = nodes[index];
    const node2 = nodes[index + 1];
    const node3 = nodes[index + 2];

    if (
      isDesignation(node1) &&
      canBeInitial(node2) &&
      isUnclassifiedWord(node3) &&
      !canHaveDesignationAdjective(node3)
    ) {
      (node2 as AddressNodeWithWord).wordType = "initial";
      node2.value = `${node2.value[0]}.`;
    }
  }

  // Expand designation adjectives (мал. → малый)
  for (const node of nodes) {
    if (!isUnclassifiedWord(node)) {
      continue;
    }

    const designationAdjectiveConfig =
      designationAdjectiveConfigLookup[node.value];
    if (!designationAdjectiveConfig) {
      continue;
    }

    (node as AddressNodeWithWord).wordType = "designationAdjective";
    if (isNormalizedDesignationAdjective(node.value)) {
      continue;
    }

    const designationConfig = findRelevantDesignation(nodes, node);
    if (!designationConfig) {
      continue;
    }
    node.value =
      designationAdjectiveConfig.normalizedValueByGender[
        designationConfig.gender
      ];
  }

  // Remove . at the end of unclassified words
  for (const node of nodes) {
    if (!isUnclassifiedWord(node)) {
      continue;
    }
    if (node.value.endsWith(".")) {
      node.value = node.value.slice(0, -1);
    }
  }

  return {
    nodeType: "cleanedAddress",
    children: nodes,
  };
};

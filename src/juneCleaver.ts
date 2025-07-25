import { Item } from "kolmafia";
import { $item, JuneCleaver, get } from "libram";

import { garboValue } from "./garboValue";
import { maxBy } from "./lib";

export const juneCleaverChoiceValues = {
  1467: {
    1: 0,
    2: 0,
    3: 5 * get("valueOfAdventure"),
  },
  1468: { 1: 0, 2: 5, 3: 0 },
  1469: { 1: 0, 2: $item`Dad's brandy`, 3: 1500 },
  1470: { 1: 0, 2: $item`teacher's pen`, 3: 0 },
  1471: { 1: $item`savings bond`, 2: 250, 3: 0 },
  1472: {
    1: $item`trampled ticket stub`,
    2: $item`fire-roasted lake trout`,
    3: 0,
  },
  1473: { 1: $item`gob of wet hair`, 2: 0, 3: 0 },
  1474: { 1: 0, 2: $item`guilty sprout`, 3: 0 },
  1475: { 1: $item`mother's necklace`, 2: 0, 3: 0 },
} as const;

function valueJuneCleaverOption(result: Item | number): number {
  return result instanceof Item ? garboValue(result) : result;
}

export function bestJuneCleaverOption(
  id: (typeof JuneCleaver.choices)[number],
): 1 | 2 | 3 {
  const options = [1, 2, 3] as const;
  return maxBy(options, (option) =>
    valueJuneCleaverOption(juneCleaverChoiceValues[id][option]),
  );
}

let juneCleaverSkipChoices: (typeof JuneCleaver.choices)[number][] | null;
function skipJuneCleaverChoices() {
  if (!juneCleaverSkipChoices) {
    juneCleaverSkipChoices = [...JuneCleaver.choices]
      .sort(
        (a, b) =>
          valueJuneCleaverOption(
            juneCleaverChoiceValues[a][bestJuneCleaverOption(a)],
          ) -
          valueJuneCleaverOption(
            juneCleaverChoiceValues[b][bestJuneCleaverOption(b)],
          ),
      )
      .splice(0, 3);
  }

  return juneCleaverSkipChoices;
}

export function shouldSkip(
  choice: (typeof JuneCleaver.choices)[number],
): boolean {
  return (
    JuneCleaver.skipsRemaining() > 0 &&
    skipJuneCleaverChoices().includes(choice)
  );
}

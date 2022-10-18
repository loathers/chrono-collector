import {
  $effect,
  $familiar,
  $item,
  $items,
  $location,
  $monster,
  $skill,
  getBanishedMonsters,
  getModifier,
  have,
} from "libram";
import { availableAmount, haveEffect, retrieveItem, use } from "kolmafia";
import { ChronerQuest, ChronerStrategy, ChronerTask } from "./engine";
import Macro from "./macro";
import { chooseQuestOutfit, ifHave } from "./outfit";

const location = $location`Moonshiners' Woods`;
const banishers = $items`ice house, human musk`;
const dfss = $skill`Double-Fisted Skull Smashing`;

export const gooso: ChronerQuest = {
  name: "Gooso",
  location,
  tasks: [
    ...banishers.map(
      (i): ChronerTask => {
        return {
          name: `Banisher ${i}`,
          completed: () => have(i) || getBanishedMonsters().has(i),
          do: () => retrieveItem(i),
          sobriety: "sober",
        };
      }
    ),
    {
      name: "Blue Taffy",
      completed: () => haveEffect($effect`Blue Swayed`) < 50,
      tryAcquire: [{ item: $item`pulled blue taffy`, price: 10000 }],
      do: () => use($item`pulled blue taffy`),
      sobriety: "sober",
    },
    {
      name: "Gooso",
      completed: () => false,
      do: location,
      combat: new ChronerStrategy(
        Macro.if_($monster`Moonshriner`, Macro.item($item`ice house`))
          .if_($monster`unstill`, Macro.item($item`human musk`))
          .if_($monster`banjoccultist`, Macro.trySkill($skill`Emit Matter Duplicating Drones`))
          .standardCombat()
      ),
      sobriety: "sober",
      outfit: chooseQuestOutfit(
        { location, isFree: false },
        { familiar: $familiar`Grey Goose`, famequip: $item`grey down vest`, modifier: "Item Drop" },
        ifHave("acc1", $item`teacher's pen`, () => getModifier("Familiar Experience") < 8),
        ifHave(
          "acc2",
          $item`teacher's pen`,
          () => availableAmount($item`teacher's pen`) > 1 && getModifier("Familiar Experience") < 6
        ),
        ifHave(
          "offhand",
          $item`yule hatchet`,
          () => getModifier("Familiar Experience") < 4 && have($item`June cleaver`) && have(dfss)
        ),
        ifHave(
          "weapon",
          $item`yule hatchet`,
          () => getModifier("Familiar Experience") < 4 && !(have($item`June cleaver`) || have(dfss))
        )
      ),
    },
  ],
};

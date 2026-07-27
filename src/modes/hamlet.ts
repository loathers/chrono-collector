import { banishCombat, banishOutfitSpec, prepareBanishes } from "../banish";
import { type ChronerQuest, ChronerStrategy } from "../engine";
import Macro from "../macro";
import { chooseQuestOutfit, ifHave } from "../outfit";
import {
  $item,
  $items,
  $location,
  $monsters,
  getKramcoWandererChance,
} from "libram";

const location = $location`Historically-Accurate Hamlet`;

// Monsters we want banished for the whole day.
const banishTargets = $monsters`soused tosspot, knight in lightweight armor`;

export const quest: ChronerQuest = {
  name: "Hamlet",
  location,
  tasks: [
    {
      name: "Hamlet",
      completed: () => false,
      do: location,
      outfit: () => {
        const sausageSpec =
          getKramcoWandererChance() >= 1
            ? ifHave("offhand", $item`Kramco Sausage-o-Matic™`)
            : {};
        return chooseQuestOutfit(
          { location, isFree: getKramcoWandererChance() >= 1 },
          sausageSpec,
          banishOutfitSpec(banishTargets),
        );
      },
      prepare: () => prepareBanishes(banishTargets),
      combat: new ChronerStrategy(() =>
        banishCombat(banishTargets, () => Macro.standardCombat()),
      ),
      sobriety: "either",
    },
  ],
};

export const targetItems = $items`tactical jester's cap, The Wizard's Android`;

import { ChronerQuest, ChronerStrategy } from "../engine";
import Macro from "../macro";
import { chooseQuestOutfit, ifHave } from "../outfit";
import { $item, $items, $location, getKramcoWandererChance } from "libram";

const location = $location`The Cave Before Time`;
export const quest: ChronerQuest = {
  name: "Capsule",
  location,
  tasks: [
    {
      name: "Chroner",
      completed: () => false,
      do: $location`The Cave Before Time`,
      outfit: () => {
        const sausageSpec =
          getKramcoWandererChance() >= 1
            ? ifHave("offhand", $item`Kramco Sausage-o-Matic™`)
            : {};
        return chooseQuestOutfit(
          { location, isFree: getKramcoWandererChance() >= 1 },
          sausageSpec,
        );
      },
      combat: new ChronerStrategy(() => Macro.standardCombat()),
      sobriety: "either",
    },
  ],
};

export const targetItems = $items`twitching time capsule`;

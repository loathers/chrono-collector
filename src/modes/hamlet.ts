import { ChronerQuest, ChronerStrategy } from "../engine";
import Macro from "../macro";
import { chooseQuestOutfit, ifHave } from "../outfit";
import { $item, $items, $location, getKramcoWandererChance } from "libram";

// eslint-disable-next-line
const location = $location`Historically-Accurate Hamlet`;

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
        );
      },
      combat: new ChronerStrategy(() => Macro.standardCombat()),
      sobriety: "either",
    },
  ],
};

// eslint-disable-next-line
export const targetItems = $items`wooden juggling ball, tactical jester's cap, The Wizard's Android`;

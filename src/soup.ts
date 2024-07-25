import { $item, $location, getKramcoWandererChance } from "libram";

import { ChronerQuest, ChronerStrategy } from "./engine";
import Macro from "./macro";
import { chooseQuestOutfit, ifHave } from "./outfit";

// eslint-disable-next-line libram/verify-constants
const location = $location`The Primordial Stew`;

export const soup: ChronerQuest = {
  name: "Soup",
  location,
  tasks: [
    {
      name: "Soup",
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

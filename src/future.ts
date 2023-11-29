import { $item, $location, $monster, getKramcoWandererChance } from "libram";

import { ChronerQuest, ChronerStrategy } from "./engine";
import { sober } from "./lib";
import Macro from "./macro";
import { chooseQuestOutfit, ifHave } from "./outfit";

// eslint-disable-next-line libram/verify-constants
const location = $location`The Home of the Future`;
// eslint-disable-next-line libram/verify-constants
const monster = $monster`robot maid`;

export const future: ChronerQuest = {
  name: "Home of the Future",
  location,
  tasks: [
    {
      name: "Core",
      completed: () => false,
      do: location,
      outfit: () => {
        const drunkSpec = sober()
          ? {}
          : { offhand: $item`Drunkula's wineglass` };
        const sausageSpec =
          getKramcoWandererChance() >= 1
            ? ifHave("offhand", $item`Kramco Sausage-o-Matic™`)
            : {};
        return chooseQuestOutfit(
          { location, isFree: getKramcoWandererChance() >= 1 },
          sausageSpec,
          drunkSpec,
        );
      },
      combat: new ChronerStrategy(() =>
        Macro.seeMoreOf(monster).standardCombat(),
      ),
      sobriety: "either",
    },
  ],
};

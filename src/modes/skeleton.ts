import { ChronerQuest, ChronerStrategy } from "../engine";
import Macro from "../macro";
import { chooseQuestOutfit, ifHave } from "../outfit";
import { $item, $items, $location, getKramcoWandererChance } from "libram";

// eslint-disable-next-line libram/verify-constants
const location = $location`No Man's and No Skeleton's Land`;

export const quest: ChronerQuest = {
  name: "Skeleton",
  location,
  tasks: [
    {
      name: "No Man's and No Skeleton's Land",
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

// eslint-disable-next-line libram/verify-constants
export const targetItems = $items`confetti grenade, orphaned baby skeleton, ordnance magnet`;

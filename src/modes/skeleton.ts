import { ChronerQuest, ChronerStrategy } from "../engine";
import Macro from "../macro";
import { chooseQuestOutfit, ifHave } from "../outfit";
import { $item, $items, $location, getKramcoWandererChance } from "libram";

// eslint-disable-next-line libram/verify-constants
const location = $location`No Man's and No Skeleton's Land`;

// eslint-disable-next-line libram/verify-constants
const detector = $item`chocolate and nylons detector`;

export const quest: ChronerQuest = {
  name: "Skeleton",
  location,
  tasks: [
    {
      name: "No Man's and No Skeleton's Land",
      completed: () => false,
      do: location,
      acquire: [{ item: detector }],
      outfit: () => {
        const spec =
          getKramcoWandererChance() >= 1
            ? ifHave("offhand", $item`Kramco Sausage-o-Matic™`)
            : ifHave("offhand", detector);
        return chooseQuestOutfit(
          { location, isFree: getKramcoWandererChance() >= 1 },
          spec,
        );
      },
      combat: new ChronerStrategy(() => Macro.standardCombat()),
      sobriety: "either",
    },
  ],
};

// eslint-disable-next-line libram/verify-constants
export const targetItems = $items`yordnance magnet, confetti grenade, orphaned baby skeleton, chocolate rations, nice nylon stockings`;

import { ChronerQuest, ChronerStrategy } from "../engine";
import Macro from "../macro";
import { chooseQuestOutfit, ifHave } from "../outfit";
import {
  $item,
  $items,
  $location,
  $monster,
  getKramcoWandererChance,
} from "libram";

const location = $location`The Home of The Future`;
const monster = $monster`robot maid`;

export const quest: ChronerQuest = {
  name: "Home of the Future",
  location,
  tasks: [
    {
      name: "Core",
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
      combat: new ChronerStrategy(() =>
        Macro.step("pickpocket").seeMoreOf(monster).standardCombat(),
      ),
      sobriety: "either",
    },
  ],
};

export const targetItems = $items`housekeeping automa-core`;

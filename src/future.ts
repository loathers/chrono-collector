import { $item, $location, $monster, getKramcoWandererChance } from "libram";

import { ChronerQuest, ChronerStrategy } from "./engine";
import Macro from "./macro";
import { chooseQuestOutfit, ifHave } from "./outfit";
import { sessionStorage, visitUrl } from "kolmafia";

// eslint-disable-next-line libram/verify-constants
const location = $location`The Home of the Future`;
// eslint-disable-next-line libram/verify-constants
const monster = $monster`robot maid`;

export function getBestAutomatedFutureSide() {
  const stored = sessionStorage.getItem("automatedFutureBest");
  if (stored) return stored;

  const page = visitUrl("place.php?whichplace=twitch");
  const springbros = Number(
    page.match(/title='(-?\d+)' href=adventure.php\?snarfblat=581/)?.[1] ?? "0",
  );
  const boltsmann = Number(
    page.match(/title='(-?\d+)' href=adventure.php\?snarfblat=582/)?.[1] ?? "0",
  );
  const best = springbros > boltsmann ? "springbros" : "boltsmann";
  sessionStorage.setItem("automatedFutureBest", best);
  return best;
}

export const future: ChronerQuest = {
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
        Macro.seeMoreOf(monster).standardCombat(),
      ),
      sobriety: "either",
    },
  ],
};

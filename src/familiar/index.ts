import { canInteract, Familiar, inebrietyLimit, Item, myInebriety } from "kolmafia";
import { $familiar, $familiars, $item, have } from "libram";

import { freeFightFamiliar } from "./freeFightFamiliar";
import { canOpenRedPresent, MenuOptions, pocketProfessorLectures, timeToMeatify } from "./lib";

export { canOpenRedPresent, timeToMeatify, pocketProfessorLectures, freeFightFamiliar };

export const chooseFamiliar = (options: MenuOptions = {}) =>
  canInteract() && myInebriety() <= inebrietyLimit()
    ? $familiars`Reagnimated Gnome, Temporal Riftlet`.find((f) => have(f)) ??
      freeFightFamiliar(options)
    : freeFightFamiliar();
export const chooseFamEquip = (fam: Familiar) => {
	switch(fam) {
		case $familiar`Reagnimated Gnome`:
			return $item`gnomish housemaid's kgnee`;
		case $familiar`Shorter-Order Cook`:
			return $item`blue plate`;
		default:
			if(fam.elementalDamage || fam.physicalDamage)
				return $item`tiny stillsuit`;
			return $item`oversized fish scaler`;
	}
}

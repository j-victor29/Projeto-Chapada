import { useEffect } from "react";
import { atividadesMock } from "./mockData";
import { seedOwnership } from "./ownershipStore";

export function useSeedOwnership() {
  useEffect(() => {
    // atividadesMock is already sorted desc by date in mockData.ts
    const sortedIds = atividadesMock.map((a) => a.id);
    const projMap: Record<string, string> = {};
    atividadesMock.forEach((a) => {
      projMap[a.id] = a.projetoId;
    });
    seedOwnership(sortedIds, projMap);
  }, []);
}

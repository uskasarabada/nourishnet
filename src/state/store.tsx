import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { FoodCategory, FoodDrive, Shelter, UserProfile } from '../lib/types';
import { fitModel, rollingBacktest, rowsFromDrives, type BacktestSummary, type Model } from '../lib/forecast';
import { learnedCategoryShares } from '../lib/resources';
import { localRepository, type Snapshot } from './repository';
import { todayISO } from '../lib/dates';

type Action =
  | { type: 'createDrive'; drive: FoodDrive }
  | { type: 'logDonation'; driveId: string; category: FoodCategory; lbs: number }
  | { type: 'completeDrive'; driveId: string; actualParticipants: number }
  | { type: 'toggleShift'; shiftId: string; driveId: string }
  | { type: 'updateShelterNeed'; shelterId: string; delivered: Partial<Record<FoodCategory, number>> }
  | { type: 'verifyShelter'; shelterId: string }
  | { type: 'reset' };

function reducer(s: Snapshot, a: Action): Snapshot {
  switch (a.type) {
    case 'createDrive':
      return {
        ...s,
        drives: [...s.drives, a.drive],
        user: { ...s.user, organizedDriveIds: [...s.user.organizedDriveIds, a.drive.id] },
      };
    case 'logDonation':
      return {
        ...s,
        drives: s.drives.map((d) => {
          if (d.id !== a.driveId) return d;
          const collected = (d.collectedLbs ?? 0) + a.lbs;
          const today = todayISO();
          const log = [...(d.dailyLog ?? [])];
          if (log.length && log[log.length - 1].day === today) log[log.length - 1] = { day: today, lbs: collected };
          else log.push({ day: today, lbs: collected });
          return {
            ...d,
            collectedLbs: collected,
            collectedByCategory: { ...d.collectedByCategory, [a.category]: (d.collectedByCategory?.[a.category] ?? 0) + a.lbs },
            dailyLog: log,
          };
        }),
      };
    case 'completeDrive':
      return {
        ...s,
        drives: s.drives.map((d) => (d.id === a.driveId ? { ...d, status: 'completed', actualParticipants: a.actualParticipants } : d)),
      };
    case 'toggleShift': {
      const on = s.user.signedUpShiftIds.includes(a.shiftId);
      return {
        ...s,
        user: {
          ...s.user,
          signedUpShiftIds: on ? s.user.signedUpShiftIds.filter((x) => x !== a.shiftId) : [...s.user.signedUpShiftIds, a.shiftId],
        },
        drives: s.drives.map((d) =>
          d.id !== a.driveId ? d : { ...d, shifts: d.shifts.map((sh) => (sh.id === a.shiftId ? { ...sh, filled: sh.filled + (on ? -1 : 1) } : sh)) },
        ),
      };
    }
    case 'updateShelterNeed':
      return {
        ...s,
        shelters: s.shelters.map((sh) =>
          sh.id !== a.shelterId
            ? sh
            : {
                ...sh,
                needs: sh.needs.map((n) => {
                  const lbs = a.delivered[n.category];
                  if (!lbs) return n;
                  const units = lbs / n.lbsPerUnit;
                  return { ...n, quantityReceived: Math.min(n.quantityNeeded, Math.round(n.quantityReceived + units)) };
                }),
              },
        ),
      };
    case 'verifyShelter':
      return { ...s, shelters: s.shelters.map((sh) => (sh.id === a.shelterId ? { ...sh, lastVerified: todayISO() } : sh)) };
    case 'reset':
      return localRepository.reset();
  }
}

interface Store extends Snapshot {
  dispatch: (a: Action) => void;
  model: Model;
  backtest: BacktestSummary;
  categoryShares: Record<FoodCategory, number>;
  driveById: (id: string) => FoodDrive | undefined;
  shelterById: (id: string) => Shelter | undefined;
  user: UserProfile;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => localRepository.load());
  useEffect(() => localRepository.save(state), [state]);

  // The model re-trains whenever the set of completed drives changes —
  // this is how every finished drive makes the next forecast better.
  const completedKey = state.drives.filter((d) => d.status === 'completed').map((d) => `${d.id}:${d.collectedLbs}`).join('|');
  const { model, backtest, categoryShares } = useMemo(() => {
    const rows = rowsFromDrives(state.drives);
    const completed = state.drives.filter((d) => d.status === 'completed');
    return { model: fitModel(rows), backtest: rollingBacktest(rows), categoryShares: learnedCategoryShares(completed) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedKey]);

  const driveById = useCallback((id: string) => state.drives.find((d) => d.id === id), [state.drives]);
  const shelterById = useCallback((id: string) => state.shelters.find((s) => s.id === id), [state.shelters]);

  const value = useMemo<Store>(
    () => ({ ...state, dispatch, model, backtest, categoryShares, driveById, shelterById }),
    [state, model, backtest, categoryShares, driveById, shelterById],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

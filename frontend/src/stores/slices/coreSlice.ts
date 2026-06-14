// stores/slices/coreSlice.ts - Core game actions slice
import type { StateCreator } from 'zustand';
import type { CoreGameActions } from '../../types/storeInterfaces';
import type { GameState } from '../../types/game';
import type { ComposedGameStore } from '../composedStore';
import { clearAuthToken } from '../../api/authStorage';
import {
  ensureGuestSession,
  loadGameState,
  persistGameState,
  startNewGame as startNewGameApi,
} from '../../api/gameApi';
import { generateId } from '../../utils/gameHelpers';
import { starterData } from '../../constants/gameData';

type PersistedBackendState = {
  [key: string]: unknown;
};

const initialResources = {
  credits: 500,
  soulEssence: 0,
  bureaucraticLeverage: 0,
  rawMaterials: 0,
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeSelectedDaemons = (value: unknown): Set<string> => {
  if (value instanceof Set) {
    return new Set([...value].filter((candidate): candidate is string => typeof candidate === 'string'));
  }

  if (Array.isArray(value)) {
    return new Set(
      value.filter((candidate): candidate is string => typeof candidate === 'string')
    );
  }

  return new Set<string>();
};

const isUnauthorizedError = (error: unknown): boolean => {
  if (!isRecord(error)) {
    return false;
  }

  const response = error.response as { status?: unknown } | undefined;
  return response?.status === 401 || response?.status === '401';
};

const makeStarterPayload = (): Record<string, unknown> => ({
  resources: {
    ...initialResources,
  },
  daemons: starterData.starter_daemons.map(daemon => ({
    ...daemon,
    id: generateId(),
    isActive: true,
    assignments: [],
    equipment: null,
  })),
  equipment: starterData.starter_equipment.map(equipment => ({
    ...equipment,
    id: generateId(),
    assignedTo: null,
  })),
  rooms: starterData.apartment_rooms.map(room => ({
    ...room,
    id: generateId(),
  })),
  planets:
    (starterData.planets || []).map(planet => ({
      ...planet,
      id: generateId(),
      conquered: false,
      lastMission: null,
    })) || [],
  recruitmentPool: [],
  activeMission: null,
  corporateEvents: [],
  gameModifiers: {
    passiveIncome: 0,
    recruitmentDiscount: 0,
    equipmentRepairDiscount: 0,
    missionSuccessBonus: 0,
    managementStress: false,
    hrInvestigation: 0,
    productivityBonus: 0,
    productivityBonusRemainingMissions: 0,
    roomSynergyBonus: 0,
    roomSynergyMissionBonus: 0,
    takeoverDefense: 0,
    espionageImmunity: 0,
    boardLoyalty: 0,
    corporateControl: 0,
    regulatoryFavor: 0,
  },
  daysPassed: 0,
  gameStarted: true,
  tutorialCompleted: false,
  reputation: 0,
  availableProceduralMissions: [],
  missionConsequences: [],
  futureOpportunities: [],
  corporateTier: {
    id: 'daemon_ops',
    name: 'Daemon Operator',
    level: 1,
    requirements: [],
    unlocks: [],
  },
  promotionProgress: {},
  complianceTasks: [],
  complianceDeadlines: {},
  legacyBook: {},
  hallOfInfamy: [],
  endgameState: {
    managementStyle: 'none',
    endingAchieved: false,
    endingType: '',
    prestigeLevel: 0,
    permanentBonuses: [],
  },
  unlockedContent: {
    daemonArchetypes: [],
    factions: [],
    events: [],
    tierFeatures: [],
  },
  corporateRivals: [],
  currentTab: 'dashboard',
  selectedDaemons: [],
  currentPlanet: null,
  selectedMissionType: 'conquest',
  showTutorial: false,
  showMemorial: false,
  showMissionModal: false,
  showMissionResults: false,
  showEventModal: false,
  memorialDaemon: null,
  missionResults: null,
  currentEvent: null,
  notifications: [],
  completedMissions: [],
  gameIntervalId: null,
  totalRestarts: 0,
});

const persistableState = (state: ComposedGameStore): PersistedBackendState => {
  const payload: PersistedBackendState = { ...state };
  payload.selectedDaemons = Array.from(state.selectedDaemons);
  payload.currentTab = state.currentTab;
  payload.showTutorial = state.showTutorial;
  payload.showMemorial = state.showMemorial;
  payload.showMissionModal = state.showMissionModal;
  payload.showMissionResults = state.showMissionResults;
  payload.showEventModal = state.showEventModal;
  payload.missionResults = state.missionResult;
  payload.currentEvent = state.currentEvent;
  return payload;
};

export type CoreSlice = CoreGameActions;

export const createCoreSlice: StateCreator<ComposedGameStore, [], [], CoreSlice> =
  (set, get) => {
    let isBootstrapping = false;
    let didBootstrap = false;

    const runWithGuestFallback = async <T>(callback: () => Promise<T>): Promise<T> => {
      try {
        return await callback();
      } catch (error) {
        if (!isUnauthorizedError(error)) {
          throw error;
        }

        clearAuthToken();
        await ensureGuestSession(true);
        return await callback();
      }
    };

    const ensureGuestAuth = async (): Promise<void> => {
      await ensureGuestSession();
    };

    const applyBackendState = (value: unknown): boolean => {
      if (!isRecord(value)) {
        return false;
      }

      const current = get();
      const parsed = value as PersistedBackendState;
      const merged = {
        ...current,
        ...parsed,
      };
      merged.selectedDaemons = normalizeSelectedDaemons(parsed.selectedDaemons);
      if ('missionResults' in parsed && !('missionResult' in parsed)) {
        merged.missionResult = parsed.missionResults as ComposedGameStore['missionResult'];
      }

      set(() => ({
        ...merged,
        selectedDaemons: merged.selectedDaemons,
      } as Partial<ComposedGameStore>));

      return true;
    };

    const seedLocalState = (): void => {
      const starter = makeStarterPayload();
      set({
        ...get(),
        ...starter,
        selectedDaemons: new Set(),
        daemons: [...((starter.daemons as unknown[]) as GameState['daemons'])],
        recruitmentPool: [...((starter.recruitmentPool as unknown[]) as GameState['recruitmentPool'])],
        rooms: [...((starter.rooms as unknown[]) as GameState['rooms'])],
        equipment: [...((starter.equipment as unknown[]) as GameState['equipment'])],
        planets: [...((starter.planets as unknown[]) as GameState['planets'])],
      });
    };

    const generateRecruitmentPoolIfAvailable = (): void => {
      const composedState = get();
      if ('generateRecruitmentPool' in composedState) {
        composedState.generateRecruitmentPool();
      }
    };

    const shouldFallbackToLocalState = (): boolean => {
      const state = get();
      return state.daemons.length === 0 && !state.gameStarted;
    };

    return {
      initializeGame: () => {
        if (didBootstrap || isBootstrapping) {
          return;
        }

        isBootstrapping = true;
        didBootstrap = true;
        void (async () => {
          try {
            await ensureGuestAuth();
            const remoteState = await runWithGuestFallback(async () => loadGameState());
            const didApply = applyBackendState(remoteState);
            if (didApply) {
              return;
            }
          } catch (error) {
            console.warn('Failed to load remote game state, using local fallback', error);
          }

          if (shouldFallbackToLocalState()) {
            seedLocalState();
            generateRecruitmentPoolIfAvailable();
          }
        })().finally(() => {
          isBootstrapping = false;
        });
      },

      startNewGame: () => {
        void (async () => {
          const starterPayload = makeStarterPayload();

          try {
            await ensureGuestAuth();
            const remoteState = await runWithGuestFallback(async () => startNewGameApi(starterPayload));
            const didApply = applyBackendState(remoteState);
            if (!didApply) {
              seedLocalState();
            }

            generateRecruitmentPoolIfAvailable();
            return;
          } catch (error) {
            console.warn('Remote start failed; using local starter defaults', error);
          }

          seedLocalState();
          generateRecruitmentPoolIfAvailable();
        })();
      },

      resetToInitialState: () => {
        set({
          resources: initialResources,
          daemons: [],
          equipment: [],
          gameStarted: false,
          daysPassed: 0,
          tutorialCompleted: false,
        });
      },

      saveGame: () => {
        void (async () => {
          try {
            const payload = persistableState(get());
            const remoteState = await runWithGuestFallback(async () => persistGameState(payload));
            applyBackendState(remoteState);
          } catch (error) {
            console.warn('Game save failed, keeping local persistence only', error);
          }
        })();
      },

      loadGame: () => {
        void (async () => {
          try {
            const remoteState = await runWithGuestFallback(async () => loadGameState());
            const didApply = applyBackendState(remoteState);
            if (!didApply && shouldFallbackToLocalState()) {
              seedLocalState();
            }
          } catch (error) {
            console.warn('Game load failed', error);
          }
        })();

        return true;
      },

      resetGame: () => {
        get().resetToInitialState();
        localStorage.removeItem('daemon-directorate-v2');
      },

      generateId,
    };
  };

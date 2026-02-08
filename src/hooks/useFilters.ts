import { useCallback, useEffect, useState } from "react";
import type { DiscoveryFilters } from "@/lib/dating";
import { logInfo } from "@/utils/logger";
import {
  DEFAULT_FILTERS,
  FILTER_STORAGE_KEY,
  GENDER_OPTIONS,
  PREFERRED_COHORT_OPTIONS,
  PREFERRED_INTENTION_OPTIONS,
} from "@/lib/dating";

function loadFilters(): DiscoveryFilters {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DiscoveryFilters>;
      const filters: DiscoveryFilters = {
        ageMin: typeof parsed.ageMin === "number" ? parsed.ageMin : DEFAULT_FILTERS.ageMin,
        ageMax: typeof parsed.ageMax === "number" ? parsed.ageMax : DEFAULT_FILTERS.ageMax,
        gendersInterestedIn: Array.isArray(parsed.gendersInterestedIn)
          ? parsed.gendersInterestedIn
          : DEFAULT_FILTERS.gendersInterestedIn,
        preferredCohorts: Array.isArray(parsed.preferredCohorts)
          ? parsed.preferredCohorts
          : DEFAULT_FILTERS.preferredCohorts,
        preferredIntention:
          parsed.preferredIntention != null && typeof parsed.preferredIntention === "string"
            ? parsed.preferredIntention
            : DEFAULT_FILTERS.preferredIntention,
      };
      return filters;
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_FILTERS };
}

function saveFilters(f: DiscoveryFilters) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(f));
  } catch {
    // ignore
  }
}

export function useFilters() {
  const [filters, setFiltersState] = useState<DiscoveryFilters>(loadFilters);

  useEffect(() => {
    logInfo("Filters loaded", { component: "useFilters", operation: "loadFilters", extra: filters });
  }, []);

  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  const setFilters = useCallback((next: DiscoveryFilters | ((prev: DiscoveryFilters) => DiscoveryFilters)) => {
    setFiltersState((prev) => {
      const nextVal = typeof next === "function" ? next(prev) : next;
      logInfo("Filters updated", { component: "useFilters", operation: "setFilters", extra: nextVal });
      return nextVal;
    });
  }, []);

  return {
    filters,
    setFilters,
    genderOptions: GENDER_OPTIONS,
    preferredCohortOptions: PREFERRED_COHORT_OPTIONS,
    preferredIntentionOptions: PREFERRED_INTENTION_OPTIONS,
  };
}

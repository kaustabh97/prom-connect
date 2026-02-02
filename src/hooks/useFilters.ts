import { useCallback, useEffect, useState } from "react";
import type { DiscoveryFilters } from "@/lib/dating";
import {
  DEFAULT_FILTERS,
  FILTER_STORAGE_KEY,
  GENDER_OPTIONS,
  NON_NEGOTIABLE_OPTIONS,
} from "@/lib/dating";

function loadFilters(): DiscoveryFilters {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DiscoveryFilters;
      return {
        ageMin: typeof parsed.ageMin === "number" ? parsed.ageMin : DEFAULT_FILTERS.ageMin,
        ageMax: typeof parsed.ageMax === "number" ? parsed.ageMax : DEFAULT_FILTERS.ageMax,
        gendersInterestedIn: Array.isArray(parsed.gendersInterestedIn)
          ? parsed.gendersInterestedIn
          : DEFAULT_FILTERS.gendersInterestedIn,
        nonNegotiables: Array.isArray(parsed.nonNegotiables)
          ? parsed.nonNegotiables
          : DEFAULT_FILTERS.nonNegotiables,
      };
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
    saveFilters(filters);
  }, [filters]);

  const setFilters = useCallback((next: DiscoveryFilters | ((prev: DiscoveryFilters) => DiscoveryFilters)) => {
    setFiltersState((prev) => {
      const nextVal = typeof next === "function" ? next(prev) : next;
      return nextVal;
    });
  }, []);

  return {
    filters,
    setFilters,
    genderOptions: GENDER_OPTIONS,
    nonNegotiableOptions: NON_NEGOTIABLE_OPTIONS,
  };
}

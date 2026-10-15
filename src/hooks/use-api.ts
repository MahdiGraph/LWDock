"use client"

import useSWR, { type SWRConfiguration } from "swr"
import { catalogUrl, fetcher, lwUrl } from "@/lib/client"

type Query = Record<string, string | number | boolean | undefined | null>

const defaults: SWRConfiguration = {
  revalidateOnFocus: false,
  shouldRetryOnError: false,
  keepPreviousData: true,
}

export function useApi<T>(url: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(url, fetcher<T>, { ...defaults, ...config } as SWRConfiguration<T>)
}

/** A Leaseweb call for one server, through the panel's gateway. */
export function useLw<T>(kind: string, id: string, sub: string | null, query?: Query, config?: SWRConfiguration<T>) {
  return useApi<T>(sub === null ? null : lwUrl(kind, id, sub, query), config)
}

export function useCatalog<T>(path: string | null, query?: Query, config?: SWRConfiguration<T>) {
  return useApi<T>(path === null ? null : catalogUrl(path, query), { revalidateIfStale: false, ...config })
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "./store";
import type { Tx } from "./types";
import { fetchAllTransactions } from "./data";

export function useTransactions() {
  const { sb, household } = useApp();
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!household) return;
    try {
      setTxs(await fetchAllTransactions(sb, household.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [sb, household]);

  useEffect(() => {
    let cancelled = false;
    if (!household) return;
    fetchAllTransactions(sb, household.id)
      .then((t) => {
        if (!cancelled) setTxs(t);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [sb, household]);

  const upsert = useCallback((tx: Tx) => {
    setTxs((list) => {
      const rest = (list ?? []).filter((t) => t.id !== tx.id);
      return [tx, ...rest].sort(
        (a, b) =>
          b.occurred_on.localeCompare(a.occurred_on) ||
          b.created_at.localeCompare(a.created_at),
      );
    });
  }, []);

  const remove = useCallback((id: string) => {
    setTxs((list) => (list ?? []).filter((t) => t.id !== id));
  }, []);

  return { txs: txs ?? [], loading: txs === null, error, upsert, remove, reload };
}

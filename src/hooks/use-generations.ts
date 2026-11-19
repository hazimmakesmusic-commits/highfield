"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Generation } from "@/lib/generations";
import type { ToolId } from "@/lib/models";

const POLL_MS = 4000;
const pending = (g: Generation) => g.status === "processing" || g.status === "starting";

/** Lists generations and keeps polling the unfinished ones until they settle. */
export function useGenerations(tool?: ToolId) {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/generations${tool ? `?tool=${tool}` : ""}`);
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setItems(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tool]);

  useEffect(() => { load(); }, [load]);

  // Sequential loop: a free-provider poll can hold the request open for up to ~45s, so never overlap them.
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      const todo = itemsRef.current.filter(pending);
      if (todo.length) {
        const fresh = await Promise.all(todo.map(async (g) => {
          const res = await fetch(`/api/generations/${g.id}`).catch(() => null);
          return res ? ((await res.json().catch(() => g)) as Generation) : g;
        }));
        if (stop) return;
        setItems((cur) => cur.map((g) => fresh.find((f) => f.id === g.id) ?? g));
      }
      if (!stop) timer = setTimeout(tick, POLL_MS);
    }
    timer = setTimeout(tick, POLL_MS);
    return () => { stop = true; clearTimeout(timer); };
  }, []);

  const add = (g: Generation) => setItems((cur) => [g, ...cur]);
  const remove = async (id: string) => {
    const res = await fetch(`/api/generations/${id}`, { method: "DELETE" });
    if (res.ok) setItems((cur) => cur.filter((g) => g.id !== id));
  };
  return { items, loading, error, add, remove, reload: load };
}

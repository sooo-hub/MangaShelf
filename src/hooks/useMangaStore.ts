import { useState, useEffect, useCallback } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db, COLLECTION } from "../lib/firebase";
import type { Manga } from "../types/manga";

export function useMangaStore() {
  const [list, setList] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Manga[] = snapshot.docs.map((d) => ({
          ...(d.data() as Omit<Manga, "id">),
          id: d.id,
        }));
        setList(items);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore error:", err);
        setError("データの読み込みに失敗しました");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const addManga = useCallback(async (item: Omit<Manga, "id" | "createdAt" | "updatedAt" | "ownedVolumes">) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const now = Date.now();
    const manga: Manga = {
      ...item,
      id,
      ownedVolumes: [],
      wishUsers: item.wishUsers ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, COLLECTION, id), manga);
  }, []);

  const saveManga = useCallback(async (updated: Manga) => {
    await setDoc(doc(db, COLLECTION, updated.id), { ...updated, updatedAt: Date.now() });
  }, []);

  const deleteManga = useCallback(async (id: string) => {
    await deleteDoc(doc(db, COLLECTION, id));
  }, []);

  // 一括更新: Firestore上の複数ドキュメントを一度に更新
  const updateMangaVolume = useCallback(async (id: string, latestVolume: number, status: string) => {
    await setDoc(
      doc(db, COLLECTION, id),
      { latestVolume, status, updatedAt: Date.now() },
      { merge: true }
    );
  }, []);

  return { list, loading, error, addManga, saveManga, deleteManga, updateMangaVolume };
}

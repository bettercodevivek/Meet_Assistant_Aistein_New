"use client";

import { useCallback, useEffect, useState } from "react";

import type { FavoriteAvatar } from "@/lib/avatars/favoritesStorage";

async function fetchFavoritesFromApi(): Promise<FavoriteAvatar[]> {
  const res = await fetch("/api/me/favorite-avatars", {
    credentials: "include",
  });
  const data = (await res.json()) as {
    success?: boolean;
    favorites?: FavoriteAvatar[];
  };
  if (!res.ok || !data.success || !Array.isArray(data.favorites)) {
    return [];
  }
  return data.favorites;
}

export function useFavoriteAvatars() {
  const [favorites, setFavorites] = useState<FavoriteAvatar[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async (): Promise<FavoriteAvatar[]> => {
    try {
      const list = await fetchFavoritesFromApi();
      setFavorites(list);
      return list;
    } catch {
      setFavorites([]);
      return [];
    } finally {
      setLoaded(true);
    }
  }, []);

  const setFavoritesAndPersist = useCallback(
    async (next: FavoriteAvatar[]): Promise<boolean> => {
      try {
        const res = await fetch("/api/me/favorite-avatars", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ favorites: next }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          favorites?: FavoriteAvatar[];
        };
        if (res.ok && data.success && Array.isArray(data.favorites)) {
          setFavorites(data.favorites);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { favorites, refresh, setFavoritesAndPersist, loaded };
}

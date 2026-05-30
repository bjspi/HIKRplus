import type { CacheStats, RouteCacheEntry, TourCacheRecord, WaypointCacheRecord } from "./types";

type StoreName = "tours" | "waypoints" | "routes";
type StoredRecord = TourCacheRecord | WaypointCacheRecord | RouteCacheEntry;

const DB_NAME = "hikr-extension-cache";
const DB_VERSION = 1;
const STORES: StoreName[] = ["tours", "waypoints", "routes"];

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function tx<T>(storeName: StoreName, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = fn(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function put<T extends StoredRecord>(store: StoreName, value: T): Promise<T> {
  await tx(store, "readwrite", (objectStore) => objectStore.put(value));
  return value;
}

async function get<T extends StoredRecord>(store: StoreName, id: string): Promise<T | undefined> {
  return tx<T | undefined>(store, "readonly", (objectStore) => objectStore.get(id));
}

async function getAll<T extends StoredRecord>(store: StoreName): Promise<T[]> {
  return tx<T[]>(store, "readonly", (objectStore) => objectStore.getAll());
}

async function clear(store: StoreName): Promise<void> {
  await tx(store, "readwrite", (objectStore) => objectStore.clear());
}

async function count(store: StoreName): Promise<number> {
  return tx<number>(store, "readonly", (objectStore) => objectStore.count());
}

export const cache = {
  putTour: (tour: TourCacheRecord) => put("tours", tour),
  getTour: (id: string) => get<TourCacheRecord>("tours", id),
  getAllTours: () => getAll<TourCacheRecord>("tours"),
  putWaypoint: (waypoint: WaypointCacheRecord) => put("waypoints", waypoint),
  getWaypoint: (id: string) => get<WaypointCacheRecord>("waypoints", id),
  getAllWaypoints: () => getAll<WaypointCacheRecord>("waypoints"),
  putRoute: (route: RouteCacheEntry) => put("routes", route),
  getRoute: (id: string) => get<RouteCacheEntry>("routes", id),
  getAllRoutes: () => getAll<RouteCacheEntry>("routes"),
  async clearAll() {
    await Promise.all(STORES.map((store) => clear(store)));
  },
  async clearRoutes() {
    await clear("routes");
  },
  async stats(): Promise<CacheStats> {
    const [tours, waypoints, routes] = await Promise.all(STORES.map((store) => count(store)));
    return { tours, waypoints, routes };
  }
};

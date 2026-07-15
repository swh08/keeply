import { get, set } from "idb-keyval";
import { clearLocalData } from "@/db/local/database";

let activeUserId: string | undefined;
const ACTIVE_USER_KEY = "keeply:active-user-id";

export async function initializeActiveUser(userId: string) {
  const previousUserId = await get<string>(ACTIVE_USER_KEY);
  const userChanged = Boolean(previousUserId && previousUserId !== userId);
  if (userChanged) await clearLocalData();
  activeUserId = userId;
  await set(ACTIVE_USER_KEY, userId);
  return userChanged;
}

export function clearActiveUserId() {
  activeUserId = undefined;
}

export function getActiveUserId() {
  if (!activeUserId) throw new Error("No authenticated local user is active");
  return activeUserId;
}

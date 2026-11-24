export const PROFILE_STORAGE_KEY = "jupas-grade-profiles-v1";
const CORE_KEYS = ["Chinese", "English", "Mathematics", "CSD"];
const ELECTIVE_SLOTS = 6;
const DEFAULT_PROFILE_ID = "default";
const DEFAULT_PROFILE_NAME = "預設成績檔案";

export function createEmptyGrades() {
  return {
    core: {
      Chinese: "",
      English: "",
      Mathematics: "",
      CSD: "",
    },
    electives: Array.from({ length: ELECTIVE_SLOTS }, () => ({ subject: "", grade: "" })),
    categoryB: [],
    categoryC: { language: "", grade: "" },
  };
}

export function normalizeGrades(raw) {
  const empty = createEmptyGrades();
  if (!raw || typeof raw !== "object") return empty;

  const core = { ...empty.core };
  for (const key of CORE_KEYS) {
    if (typeof raw.core?.[key] === "string") {
      core[key] = raw.core[key];
    }
  }

  const rawElectives = Array.isArray(raw.electives) ? raw.electives : [];
  const electives = Array.from({ length: ELECTIVE_SLOTS }, (_, index) => {
    const entry = rawElectives[index];
    return {
      subject: typeof entry?.subject === "string" ? entry.subject : "",
      grade: typeof entry?.grade === "string" ? entry.grade : "",
    };
  });

  const rawCategoryB = Array.isArray(raw.categoryB) ? raw.categoryB : [];
  const categoryB = rawCategoryB
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      subject: typeof entry.subject === "string" ? entry.subject : "",
      grade: typeof entry.grade === "string" ? entry.grade : "",
    }));

  const categoryC = {
    language: typeof raw.categoryC?.language === "string" ? raw.categoryC.language : "",
    grade: typeof raw.categoryC?.grade === "string" ? raw.categoryC.grade : "",
  };

  return { core, electives, categoryB, categoryC };
}

function createDefaultStore() {
  return {
    version: 1,
    activeProfileId: DEFAULT_PROFILE_ID,
    lastProgrammeCode: "",
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        name: DEFAULT_PROFILE_NAME,
        updatedAt: new Date().toISOString(),
        grades: createEmptyGrades(),
      },
    ],
  };
}

function getDefaultStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadProfileStore(storage = getDefaultStorage()) {
  if (!storage) return createDefaultStore();
  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return createDefaultStore();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.profiles) || parsed.profiles.length === 0) {
      return createDefaultStore();
    }
    const profiles = parsed.profiles
      .filter((profile) => profile && typeof profile === "object" && typeof profile.id === "string")
      .map((profile, index) => ({
        id: profile.id,
        name: typeof profile.name === "string" && profile.name.trim()
          ? profile.name.trim().slice(0, 24)
          : `成績檔案 ${index + 1}`,
        updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt : new Date().toISOString(),
        grades: normalizeGrades(profile.grades),
      }));
    if (profiles.length === 0) return createDefaultStore();

    const activeProfileId = profiles.some((profile) => profile.id === parsed.activeProfileId)
      ? parsed.activeProfileId
      : profiles[0].id;
    const lastProgrammeCode = typeof parsed.lastProgrammeCode === "string" ? parsed.lastProgrammeCode : "";

    return {
      version: 1,
      activeProfileId,
      lastProgrammeCode,
      profiles,
    };
  } catch {
    return createDefaultStore();
  }
}

export function saveProfileStore(store, storage = getDefaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function getActiveProfile(store) {
  return store.profiles.find((profile) => profile.id === store.activeProfileId) ?? store.profiles[0];
}

export function createProfile(store, { name, copyCurrent = true } = {}) {
  const trimmedName = String(name ?? "").trim().slice(0, 24);
  if (!trimmedName) return { store, profile: null, error: "請輸入檔案名稱。" };

  const active = getActiveProfile(store);
  const id = `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const profile = {
    id,
    name: trimmedName,
    updatedAt: new Date().toISOString(),
    grades: copyCurrent && active ? normalizeGrades(active.grades) : createEmptyGrades(),
  };

  return {
    store: {
      ...store,
      activeProfileId: id,
      profiles: [...store.profiles, profile],
    },
    profile,
    error: null,
  };
}

export function switchProfile(store, profileId) {
  if (!store.profiles.some((profile) => profile.id === profileId)) return store;
  return {
    ...store,
    activeProfileId: profileId,
  };
}

export function renameProfile(store, profileId, name) {
  const trimmedName = String(name ?? "").trim().slice(0, 24);
  if (!trimmedName) return { store, error: "請輸入檔案名稱。" };
  return {
    store: {
      ...store,
      profiles: store.profiles.map((profile) =>
        profile.id === profileId
          ? { ...profile, name: trimmedName, updatedAt: new Date().toISOString() }
          : profile),
    },
    error: null,
  };
}

export function deleteProfile(store, profileId) {
  if (store.profiles.length <= 1) {
    return { store, error: "最少需保留一個成績檔案。" };
  }
  const remaining = store.profiles.filter((profile) => profile.id !== profileId);
  if (remaining.length === store.profiles.length) return { store, error: null };
  const activeProfileId = store.activeProfileId === profileId ? remaining[0].id : store.activeProfileId;
  return {
    store: {
      ...store,
      activeProfileId,
      profiles: remaining,
    },
    error: null,
  };
}

export function updateActiveProfileGrades(store, grades) {
  const normalized = normalizeGrades(grades);
  const updatedAt = new Date().toISOString();
  return {
    ...store,
    profiles: store.profiles.map((profile) =>
      profile.id === store.activeProfileId
        ? { ...profile, grades: normalized, updatedAt }
        : profile),
  };
}

export function countEnteredSubjects(grades) {
  const normalized = normalizeGrades(grades);
  let count = 0;
  for (const key of CORE_KEYS) {
    if (normalized.core[key]) count += 1;
  }
  for (const entry of normalized.electives) {
    if (entry.subject && entry.grade) count += 1;
  }
  for (const entry of normalized.categoryB) {
    if (entry.subject && entry.grade) count += 1;
  }
  if (normalized.categoryC.language && normalized.categoryC.grade) {
    count += 1;
  }
  return count;
}

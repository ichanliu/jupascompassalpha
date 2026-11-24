import test from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_STORAGE_KEY,
  countEnteredSubjects,
  createProfile,
  deleteProfile,
  getActiveProfile,
  loadProfileStore,
  renameProfile,
  saveProfileStore,
  switchProfile,
  updateActiveProfileGrades,
} from "./profile.js";

function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}

test("loads default profile when localStorage is empty or corrupted", () => {
  const emptyStore = loadProfileStore(createMemoryStorage());
  assert.equal(emptyStore.profiles.length, 1);
  assert.equal(emptyStore.activeProfileId, emptyStore.profiles[0].id);

  const corruptStore = loadProfileStore(createMemoryStorage({ [PROFILE_STORAGE_KEY]: "{bad-json" }));
  assert.equal(corruptStore.profiles.length, 1);
});

test("persists entered grades and restores them across reloads", () => {
  const storage = createMemoryStorage();
  let store = loadProfileStore(storage);
  store = updateActiveProfileGrades(store, {
    core: { Chinese: "5", English: "5*", Mathematics: "5**", CSD: "Attained" },
    electives: [
      { subject: "Physics", grade: "5*" },
      { subject: "Chemistry", grade: "5" },
    ],
    categoryB: [{ subject: "Applied Learning", grade: "Attained with Distinction (II)" }],
    categoryC: { language: "Japanese", grade: "N2" },
  });
  store = { ...store, lastProgrammeCode: "JS5101" };
  assert.equal(saveProfileStore(store, storage), true);

  const reloaded = loadProfileStore(storage);
  const active = getActiveProfile(reloaded);
  assert.equal(reloaded.lastProgrammeCode, "JS5101");
  assert.equal(active.grades.core.English, "5*");
  assert.equal(active.grades.electives[0].subject, "Physics");
  assert.equal(active.grades.electives[0].grade, "5*");
  assert.equal(active.grades.categoryC.language, "Japanese");
  assert.equal(active.grades.categoryC.grade, "N2");
  assert.equal(countEnteredSubjects(active.grades), 8);
});

test("supports creating, switching, renaming, and deleting profiles", () => {
  let store = loadProfileStore(createMemoryStorage());
  store = updateActiveProfileGrades(store, {
    core: { Chinese: "4", English: "5", Mathematics: "5", CSD: "Attained" },
  });

  const created = createProfile(store, { name: "Mock 成績", copyCurrent: true });
  assert.equal(created.error, null);
  store = created.store;
  assert.equal(store.profiles.length, 2);
  assert.equal(getActiveProfile(store).name, "Mock 成績");
  assert.equal(getActiveProfile(store).grades.core.English, "5");

  const blankCreated = createProfile(store, { name: "保守估計", copyCurrent: false });
  store = blankCreated.store;
  assert.equal(getActiveProfile(store).grades.core.English, "");

  const renamed = renameProfile(store, blankCreated.profile.id, "目標成績");
  assert.equal(renamed.error, null);
  store = renamed.store;
  assert.equal(getActiveProfile(store).name, "目標成績");

  store = switchProfile(store, created.profile.id);
  assert.equal(getActiveProfile(store).name, "Mock 成績");

  const deleted = deleteProfile(store, created.profile.id);
  assert.equal(deleted.error, null);
  store = deleted.store;
  assert.equal(store.profiles.length, 2);

  const singleDelete = deleteProfile(deleteProfile(store, store.profiles[0].id).store, store.profiles[1].id);
  assert.ok(singleDelete.error);
});

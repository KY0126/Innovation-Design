// Firestore security rules tests — run with `npm run test:rules` (starts the Firestore emulator).
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-jiujujia",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const db = (uid: string | null): Firestore =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore() as unknown as Firestore;

async function seed(fn: (db: Firestore) => Promise<void>) {
  await env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore() as unknown as Firestore));
}

async function seedUser(uid: string, role: string) {
  await seed((d) => setDoc(doc(d, "users", uid), { role, displayName: uid, email: `${uid}@test.tw`, createdAt: new Date() }));
}

describe("users (#1)", () => {
  const profile = (role: string) => ({ role, displayName: "陳小姐", email: "chen@test.tw", createdAt: serverTimestamp() });

  it("lets a person create their own family or elder profile", async () => {
    await assertSucceeds(setDoc(doc(db("chen"), "users", "chen"), profile("family")));
    await assertSucceeds(setDoc(doc(db("lin"), "users", "lin"), profile("elder")));
  });

  it("denies self sign-up as a store role", async () => {
    await assertFails(setDoc(doc(db("chen"), "users", "chen"), profile("advisor")));
    await assertFails(setDoc(doc(db("chen"), "users", "chen"), profile("admin")));
  });

  it("denies writing someone else's profile and unauthenticated writes", async () => {
    await assertFails(setDoc(doc(db("chen"), "users", "lin"), profile("family")));
    await assertFails(setDoc(doc(db(null), "users", "chen"), profile("family")));
  });

  it("denies changing your own role", async () => {
    await seedUser("chen", "family");
    await assertFails(updateDoc(doc(db("chen"), "users", "chen"), { role: "advisor" }));
    await assertSucceeds(updateDoc(doc(db("chen"), "users", "chen"), { displayName: "陳小姐" }));
  });

  it("denies reading other people's profiles", async () => {
    await seedUser("lin", "elder");
    await assertFails(getDoc(doc(db("chen"), "users", "lin")));
  });
});

describe("closed by default", () => {
  it("denies collections without rules yet (e.g. quotes)", async () => {
    await seedUser("chen", "family");
    await assertFails(setDoc(doc(db("chen"), "quotes", "q1"), { totalTwd: 100 }));
  });
});

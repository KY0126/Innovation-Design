// Firestore security rules tests — run with `npm run test:rules` (starts the Firestore emulator).
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
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

const CODE = "AB3X9K";

async function seedHousehold(opts: { elderUid?: string | null; claimedBy?: string | null } = {}) {
  await seed(async (d) => {
    await setDoc(doc(d, "households", "h1"), {
      elderName: "林媽媽",
      address: "台中市西屯區",
      storeId: "dc-fengjia",
      familyUids: ["chen"],
      elderUid: opts.elderUid ?? null,
      inviteCode: CODE,
      createdBy: "chen",
      createdAt: new Date(),
    });
    await setDoc(doc(d, "inviteCodes", CODE), {
      householdId: "h1",
      createdBy: "chen",
      claimedBy: opts.claimedBy ?? null,
      createdAt: new Date(),
    });
  });
}

function createHouseholdBatch(d: Firestore, uid: string, overrides: Record<string, unknown> = {}) {
  const batch = writeBatch(d);
  batch.set(doc(d, "households", "h1"), {
    elderName: "林媽媽",
    address: "台中市西屯區",
    storeId: "dc-fengjia",
    familyUids: [uid],
    elderUid: null,
    inviteCode: CODE,
    createdBy: uid,
    createdAt: serverTimestamp(),
    ...overrides,
  });
  batch.set(doc(d, "inviteCodes", CODE), { householdId: "h1", createdBy: uid, claimedBy: null, createdAt: serverTimestamp() });
  return batch;
}

function joinBatch(d: Firestore, uid: string, joinCode = CODE) {
  const batch = writeBatch(d);
  batch.update(doc(d, "households", "h1"), { elderUid: uid, elderJoinedAt: serverTimestamp(), joinCode });
  batch.update(doc(d, "inviteCodes", CODE), { claimedBy: uid });
  return batch;
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

describe("households and invite codes (#2)", () => {
  it("lets a family member create a household with its invite code", async () => {
    await seedUser("chen", "family");
    await assertSucceeds(createHouseholdBatch(db("chen"), "chen").commit());
  });

  it("denies an elder or an unregistered user creating a household", async () => {
    await seedUser("lin", "elder");
    await assertFails(createHouseholdBatch(db("lin"), "lin").commit());
    await assertFails(createHouseholdBatch(db("nobody"), "nobody").commit());
  });

  it("denies invalid household data", async () => {
    await seedUser("chen", "family");
    await assertFails(createHouseholdBatch(db("chen"), "chen", { storeId: "dc-taipei" }).commit());
    await assertFails(createHouseholdBatch(db("chen"), "chen", { elderName: "" }).commit());
    await assertFails(createHouseholdBatch(db("chen"), "chen", { elderUid: "lin" }).commit());
  });

  it("only the household's family and elder can read it", async () => {
    await seedHousehold({ elderUid: "lin" });
    await assertSucceeds(getDoc(doc(db("chen"), "households", "h1")));
    await assertSucceeds(getDoc(doc(db("lin"), "households", "h1")));
    await assertFails(getDoc(doc(db("stranger"), "households", "h1")));
  });

  it("allows querying only your own households", async () => {
    await seedHousehold({ elderUid: "lin" });
    await assertSucceeds(getDocs(query(collection(db("chen"), "households"), where("familyUids", "array-contains", "chen"))));
    await assertSucceeds(getDocs(query(collection(db("lin"), "households"), where("elderUid", "==", "lin"))));
    await assertFails(getDocs(collection(db("chen"), "households")));
  });

  it("invite codes can be fetched by exact code but never listed", async () => {
    await seedHousehold();
    await seedUser("lin", "elder");
    await assertSucceeds(getDoc(doc(db("lin"), "inviteCodes", CODE)));
    await assertFails(getDocs(collection(db("lin"), "inviteCodes")));
  });

  it("other family members cannot read someone else's invite code, but may probe unused codes", async () => {
    await seedHousehold();
    await seedUser("stranger", "family");
    await assertSucceeds(getDoc(doc(db("chen"), "inviteCodes", CODE)));
    await assertFails(getDoc(doc(db("stranger"), "inviteCodes", CODE)));
    await assertSucceeds(getDoc(doc(db("stranger"), "inviteCodes", "ZZZZZZ")));
  });

  it("lets an elder join with the correct code", async () => {
    await seedHousehold();
    await seedUser("lin", "elder");
    await assertSucceeds(joinBatch(db("lin"), "lin").commit());
    await assertSucceeds(getDoc(doc(db("lin"), "households", "h1")));
  });

  it("denies joining with a wrong code", async () => {
    await seedHousehold();
    await seedUser("lin", "elder");
    await assertFails(joinBatch(db("lin"), "lin", "ZZZZZZ").commit());
  });

  it("denies a family member using the invite code", async () => {
    await seedHousehold();
    await seedUser("bro", "family");
    await assertFails(joinBatch(db("bro"), "bro").commit());
  });

  it("denies a second elder once the household has an elder", async () => {
    await seedHousehold({ elderUid: "lin", claimedBy: "lin" });
    await seedUser("other", "elder");
    await assertFails(joinBatch(db("other"), "other").commit());
  });

  it("denies an elder setting someone else as the elder", async () => {
    await seedHousehold();
    await seedUser("lin", "elder");
    const linDb = db("lin");
    const batch = writeBatch(linDb);
    batch.update(doc(linDb, "households", "h1"), { elderUid: "someone", elderJoinedAt: serverTimestamp(), joinCode: CODE });
    await assertFails(batch.commit());
  });

  it("family can edit name and address only", async () => {
    await seedHousehold();
    await assertSucceeds(updateDoc(doc(db("chen"), "households", "h1"), { address: "台中市北屯區" }));
    await assertFails(updateDoc(doc(db("chen"), "households", "h1"), { elderUid: "chen" }));
    await assertFails(updateDoc(doc(db("chen"), "households", "h1"), { familyUids: ["chen", "stranger"] }));
  });
});

describe("closed by default", () => {
  it("denies collections without rules yet (e.g. quotes)", async () => {
    await seedUser("chen", "family");
    await assertFails(setDoc(doc(db("chen"), "quotes", "q1"), { totalTwd: 100 }));
  });
});

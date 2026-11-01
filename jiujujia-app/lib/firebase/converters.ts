import type {
  DocumentData,
  FirestoreDataConverter,
  PartialWithFieldValue,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import type { Household, InviteCode, UserProfile } from "@/lib/shared/contracts";

/** Typed converter: the document id is exposed on the model as `idKey` and never written back. */
function typedConverter<T extends object>(idKey: keyof T & string): FirestoreDataConverter<T> {
  return {
    toFirestore(model: PartialWithFieldValue<T>): DocumentData {
      const data = { ...(model as Record<string, unknown>) };
      delete data[idKey];
      return data;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return { ...(snapshot.data() as object), [idKey]: snapshot.id } as T;
    },
  };
}

export const userConverter = typedConverter<UserProfile>("uid");
export const householdConverter = typedConverter<Household>("id");
export const inviteCodeConverter = typedConverter<InviteCode>("code");

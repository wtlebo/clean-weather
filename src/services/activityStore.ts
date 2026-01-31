import type { Activity } from '../types/activity';
import { db } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const STORAGE_KEY = 'ideal_time_activities';

// Helper to remove undefined values for Firestore
const sanitizeForFirestore = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => sanitizeForFirestore(v));
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            const value = obj[key];
            if (value !== undefined) {
                acc[key] = sanitizeForFirestore(value);
            }
            return acc;
        }, {} as any);
    }
    return obj;
};

export const activityStore = {
    getAll: async (userId?: string): Promise<Activity[]> => {
        if (!userId) {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                return saved ? JSON.parse(saved) : [];
            } catch (e) {
                console.error('Failed to load local activities', e);
                return [];
            }
        } else {
            try {
                const querySnapshot = await getDocs(collection(db, 'users', userId, 'activities'));
                const activities: Activity[] = [];
                querySnapshot.forEach((doc) => {
                    // We assume the doc ID is the activity ID, or it resides in the data
                    activities.push(doc.data() as Activity);
                });
                // Sort by something? Firestore doesn't guarantee order unless we index.
                // For simplicity, we can rely on client-side sort if we save an 'order' field, 
                // OR just trust the array order if we save as a single doc?
                // Saving as subcollection is better for scalability but 'reorder' is harder.
                // Let's stick to subcollection.
                // Actually, reordering is tricky with subcollections without an 'order' field.
                // Let's rely on an 'order' field in the Activity type if needed, or simple array sorting.
                // For MVP: Let's just return them. (Maybe sort by name or creation?)
                return activities;
            } catch (e) {
                console.error('Failed to load cloud activities', e);
                return [];
            }
        }
    },

    save: async (activity: Activity, userId?: string): Promise<void> => {
        if (!userId) {
            const activities = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            const index = activities.findIndex((a: Activity) => a.id === activity.id);
            if (index >= 0) activities[index] = activity;
            else activities.push(activity);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
        } else {
            // Cloud Save - Sanitize first
            const cleanActivity = sanitizeForFirestore(activity);
            await setDoc(doc(db, 'users', userId, 'activities', activity.id), cleanActivity);
        }
    },

    delete: async (id: string, userId?: string): Promise<void> => {
        if (!userId) {
            const activities = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').filter((a: Activity) => a.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
        } else {
            await deleteDoc(doc(db, 'users', userId, 'activities', id));
        }
    },

    // For reordering, we either need a huge batch update or a single document "list".
    // Given the small number of activities (limited to 1 or small #), saving the LIST as one doc "data/activities" is easier for ordering?
    // BUT we want subcollections for scale.
    // Let's use Batch Write for reorder since it's likely < 20 items.
    // Wait, if we just want to save the ORDER, we might not need to re-write content.
    // But simplest is:
    reorder: async (activities: Activity[], userId?: string): Promise<void> => {
        if (!userId) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
        } else {
            // Cloud Reorder: We must likely save an 'order' index on each doc, OR
            // simplest for this size: rewrite them? No, that's heavy.
            // Alternative: Store the "Order" as a separate array of IDs in `users/{uid}`.

            // ACTUALLY: For this MVP, let's just stick to the 'save whole list' approach... 
            // NO, we defined subcollections above.
            // Let's batch update an 'index' field on each doc.
            const batch = writeBatch(db);
            activities.forEach((activity, index) => {
                // We're mutating the activity object here to add 'sortOrder' potentially?
                // Or just blindly saving it.
                // Let's Update the activity doc with a sortOrder field.
                const ref = doc(db, 'users', userId, 'activities', activity.id);
                // Sanitize and add sortOrder
                const cleanActivity = sanitizeForFirestore({ ...activity, sortOrder: index });
                batch.set(ref, cleanActivity); // Use set to ensure clean overwrite or update
            });
            await batch.commit();
        }
    },

    migrateLocalToCloud: async (userId: string): Promise<void> => {
        try {
            // 1. Get Local
            const localRaw = localStorage.getItem(STORAGE_KEY);
            if (!localRaw) return; // Nothing to migrate
            const localActivities: Activity[] = JSON.parse(localRaw);
            if (localActivities.length === 0) return;

            // 2. Upload (Batch)
            const batch = writeBatch(db);
            localActivities.forEach((activity, index) => {
                const ref = doc(db, 'users', userId, 'activities', activity.id);
                // Sanitize and ensure numeric fields (defaults) if missing
                const cleanActivity = sanitizeForFirestore({ ...activity, sortOrder: index });
                batch.set(ref, cleanActivity);
            });
            await batch.commit();
            console.log(`Migrated ${localActivities.length} activities to cloud.`);

            // 3. Optional: Clear/Mark local?
            // For now, let's keep them as backup but maybe clear them to avoid duplicate import if logic changes?
            // User requested "import", usually implies move or copy. 
            // Let's NOT clear for safety, but we need logic to not re-import.
            // The logic in App.tsx will be "If Cloud Empty, Try Import".
        } catch (e) {
            console.error('Migration failed', e);
        }
    },

    // --- Presets (Admin) ---
    savePreset: async (activity: Activity): Promise<void> => {
        const cleanActivity = sanitizeForFirestore(activity);
        // Save to top-level collection
        await setDoc(doc(db, 'activity_presets', activity.id), cleanActivity);
    },

    getPresets: async (): Promise<Activity[]> => {
        try {
            const querySnapshot = await getDocs(collection(db, 'activity_presets'));
            const presets: Activity[] = [];
            querySnapshot.forEach((doc) => {
                presets.push(doc.data() as Activity);
            });
            return presets;
        } catch (e) {
            console.error('Failed to load presets', e);
            return [];
        }
    }
};

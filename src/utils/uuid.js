/**
 * Generates a UUID v4 string.
 * Uses crypto.randomUUID if available (Secure Context),
 * otherwise falls back to a math-based generator.
 */
export function generateUUID() {
    // Use native crypto API if available (HTTPS/Localhost)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback for non-secure contexts (HTTP)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


export function parseConfiguration(configuration = '{}') {
    try {
        return JSON.parse(configuration);
    } catch (e) {
        console.error('[CONFIG] Failed to parse configuration JSON:', e.message);
        return {};
    }
}

export const isVersionNewer = (currentVersion: string, newVersion: string): boolean => {
    const currentParts = currentVersion.split('.').map(Number);
    const newParts = newVersion.split('.').map(Number);

    for (let i = 0; i < currentParts.length; i++) {
        if (newParts[i] > currentParts[i]) {
            return true;
        } else if (newParts[i] < currentParts[i]) {
            return false;
        }
    }
    return false;
};

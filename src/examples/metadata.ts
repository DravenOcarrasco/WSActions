function generateUniqueId() {
    return Date.now() + '' + Math.random().toString(36).substr(2, 9)+"-TEMP";
}

export default function mount({
    name = "",
    version = "1.0.0",
    github = "",
    minVersion = "",
    compatibility = [] as string[],
    id = generateUniqueId(),
    WEB_SCRIPTS = [
        'client.js'
    ] as string[]
} = {}) {
    return {
        name,
        version,
        github,
        minVersion,
        compatibility,
        id,
        WEB_SCRIPTS
    }
}

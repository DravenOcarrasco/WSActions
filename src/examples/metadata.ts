function generateUniqueId() {
    return Date.now() + '' + Math.random().toString(36).substr(2, 9)+"-TEMP";
}

export default function mount({
    name = "",
    version = "1.0.0",
    github = "",
    minVersion = "",
    compatibility = [],
    id = generateUniqueId()
} = {}) {
    return {
        name,
        version,
        github,
        minVersion,
        compatibility,
        id
    }
}

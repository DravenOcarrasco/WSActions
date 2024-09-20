export default function mount({
    name = "",
    version = "1.0.0",
    github = "",
    minVersion = "",
    compatibility = []
}:any = {}){
    return {
        name,
        version,
        github,
        minVersion,
        compatibility
    }
}
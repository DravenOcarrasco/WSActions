export interface ChromeProfileInfo {
    folder_name: string;
    name: string;
    shortcut_name: string;
    user_name?: string;
    extensions: string[];
    proxy?: {
        enabled: boolean,
        ip: string,
        user: string,
        passw: string
    },
    headless?:  boolean | "shell"
}

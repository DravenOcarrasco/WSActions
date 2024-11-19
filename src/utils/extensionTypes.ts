export interface ExtensionData {
    name: string;
    version: string;
    extensionFilePath: string;
}

export interface Subscription {
    isCurrentlyActive: boolean;
    extension?: ExtensionData;
}

export interface ExtensionBackup {
    name: string;
    zipPath: string;
}

export interface ChromeProfileInfo {
    folder_name: string;
    active_time: number;
    avatar_icon: string;
    background_apps: boolean;
    default_avatar_fill_color: number;
    default_avatar_stroke_color: number;
    force_signin_profile_locked: boolean;
    gaia_given_name?: string;
    gaia_id?: string;
    gaia_name?: string;
    hosted_domain?: string;
    is_consented_primary_account: boolean;
    is_ephemeral: boolean;
    is_using_default_avatar: boolean;
    is_using_default_name: boolean;
    managed_user_id?: string;
    metrics_bucket_index: number;
    name: string;
    profile_highlight_color: number;
    shortcut_name: string;
    signin_with_credential_provider: boolean;
    user_name?: string;
    first_account_name_hash?: number;
    gaia_picture_file_name?: string;
    last_downloaded_gaia_picture_url_with_size?: string;
    user_accepted_account_management?: boolean;
    extensions: string[];
    proxy?: {
        enabled: boolean,
        ip: string,
        user: string,
        passw: string
    }
}

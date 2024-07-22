export interface ITwitch {
    id: string;
    account_id: string;
    server_id: string;
    channel_id: string;
    username: string;
    message_id: string | null;
    social_links: boolean;
    keep_vod: boolean;
    mention: string | null;
}

import fs from "fs";
interface KickToken {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
}

class KickTokenManager {
    private tokenFilePath = "./KickToken.json";

    constructor() {
        // Ensure the token file exists on initialization
        this.ensureTokenFileExists();
    }

    private ensureTokenFileExists(): void {
        if (!fs.existsSync(this.tokenFilePath)) {
            console.log("Kick Token file does not exist, creating...");
            const initialData = {};
            fs.writeFileSync(this.tokenFilePath, JSON.stringify(initialData), {
                encoding: "utf-8",
            });
            console.log("Kick Token file created.");
        }
    }

    async getAccessToken(): Promise<string | null> {
        try {
            // Read token from file
            const rawData = fs.readFileSync(this.tokenFilePath, "utf-8");
            const tokenData: KickToken = JSON.parse(rawData);

            if (tokenData.access_token) {
                return tokenData.access_token;
            } else {
                console.log("No kick access token in file, refreshing...");
                return await this.refreshAccessToken();
            }
        } catch (err) {
            console.error("Error reading or parsing kick token file:", err);
            return await this.refreshAccessToken(); // Attempt to refresh if there's an error reading the file
        }
    }

    async refreshAccessToken(): Promise<string | null> {
        try {
            // 2. Retrieve Client ID and Client Secret from environment variables
            const clientID = process.env.KICK_CLIENT_ID;
            const clientSecret = process.env.KICK_CLIENT_SECRET;
            const url = "https://id.kick.com/oauth/token";

            if (!clientID || !clientSecret) {
                throw new Error(
                    "Kick client ID and secret must be defined in environment variables."
                );
            }

            // 3. Prepare the request payload for client credentials grant
            const payload = new URLSearchParams({
                grant_type: "client_credentials",
                client_id: clientID,
                client_secret: clientSecret,
            }).toString();
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: payload,
            });
            if (!response.ok) {
                console.log(
                    "Kick Token fetch failed, trying again",
                    await response.json()
                );
                const retryResponse = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: payload,
                });

                if (!retryResponse.ok) {
                    throw new Error(
                        `Failed to fetch kick token on retry: ${retryResponse.status} ${retryResponse.statusText}`
                    );
                }

                const retryJson: KickToken =
                    (await retryResponse.json()) as KickToken;

                if (retryJson.access_token) {
                    fs.writeFileSync(
                        this.tokenFilePath,
                        JSON.stringify(retryJson)
                    );
                    console.log("Kick Token refreshed successfully.");
                    return retryJson.access_token;
                } else {
                    throw new Error(
                        `Failed to fetch kick token with retry: ${retryJson}`
                    );
                }
            }

            const json: KickToken = (await response.json()) as KickToken;

            fs.writeFileSync(this.tokenFilePath, JSON.stringify(json));
            console.log("Kick Token Saved");
            return json.access_token || null;
        } catch (err) {
            console.error("An error occurred during kick token refresh:", err);
            return null;
        }
    }
}

interface KickChannel {
    banner_picture: string;
    broadcaster_user_id: number;
    category: {
        id: number;
        name: string;
        thumbnail: string;
    };
    channel_description: string;
    slug: string;
    stream: {
        is_live: boolean;
        is_mature: boolean;
        key: string;
        language: string;
        start_time: string;
        thumbnail: string;
        url: string;
        viewer_count: number;
    };
    stream_title: string;
}
const tokenManager = new KickTokenManager();
const getKickChannelId = async (loginName: string): Promise<number | null> => {
    const accessToken = await tokenManager.getAccessToken();
    if (!accessToken) {
        console.error("Kick access token");
        return null;
    }
    const apiUrl = `https://api.kick.com/public/v1/channels?slug=${loginName}`;
    try {
        const response = await fetch(apiUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        if (!response.ok) {
            console.error(
                `Error fetching user data: ${response.status} ${response.statusText}`
            );
            const errorBody = await response.text();
            console.error("Response body:", errorBody);
            if (response.status == 401) {
                await tokenManager.refreshAccessToken();
                return await getKickChannelId(loginName);
            }
            return null;
        }
        const data = await response.json();
        if (data.data && data.data.length > 0) {
            const user: KickChannel = data.data[0] as KickChannel; // Type assertion
            return user.broadcaster_user_id;
        } else {
            console.warn(`User with login name "${loginName}" not found.`);
            return null;
        }
    } catch (error) {
        console.error("Error during fetch:", error);
        return null;
    }
};
const createEventSubSubscriptionKick = async (
    username: string,
    type: "livestream.status.updated"
) => {
    try {
        const userId = await getKickChannelId(username);
        if (!userId) {
            console.error(
                "Failed to retrieve user. Cannot create EventSub subscription."
            );
            return null;
        }
        const accessToken = await tokenManager.getAccessToken();
        if (!accessToken) {
            console.error(
                "Failed to retrieve access token. Cannot create EventSub subscription."
            );
            return null;
        }
        const subscription = {
            broadcaster_user_id: userId,
            events: [
                {
                    name: type,
                    version: 1,
                },
            ],
            method: "webhook",
        };
        const response = await fetch(
            "https://api.kick.com/public/v1/events/subscriptions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(subscription),
            }
        );
        if (!response.ok) {
            if (response.status != 409) {
                console.error(
                    `Error creating Kick EventSub subscription for ${type}: ${response.status} ${response.statusText}`
                );
                const errorBody = await response.text();
                console.error("Response body:", errorBody);
                return null;
            }
            return null;
        }
        const body = await response.json();
        return body.data?.[0]?.subscription_id;
    } catch (error) {
        console.error("Error during fetch:", error);
        return null;
    }
};
const deleteEventSubSubscriptionKick = async (sub_id: string) => {
    try {
        const accessToken = await tokenManager.getAccessToken();
        if (!accessToken) {
            console.error(
                "Failed to retrieve access token. Cannot create EventSub subscription."
            );
            return null;
        }
        await fetch(
            `https://api.kick.com/public/v1/events/subscriptions?id=${sub_id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );
        return true;
    } catch (error) {
        console.error("Error during fetch:", error);
        return null;
    }
};
export {
    KickTokenManager,
    getKickChannelId,
    createEventSubSubscriptionKick,
    deleteEventSubSubscriptionKick,
};

import fs from "fs";
interface TwitchToken {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
}

class TwitchTokenManager {
    private tokenFilePath = "./TwitchToken.json";

    constructor() {
        // Ensure the token file exists on initialization
        this.ensureTokenFileExists();
    }

    private ensureTokenFileExists(): void {
        if (!fs.existsSync(this.tokenFilePath)) {
            console.log("Token file does not exist, creating...");
            const initialData = {};
            fs.writeFileSync(this.tokenFilePath, JSON.stringify(initialData), {
                encoding: "utf-8",
            });
            console.log("Token file created.");
        }
    }

    async getAccessToken(): Promise<string | null> {
        try {
            // Read token from file
            const rawData = fs.readFileSync(this.tokenFilePath, "utf-8");
            const tokenData: TwitchToken = JSON.parse(rawData);

            if (tokenData.access_token) {
                return tokenData.access_token;
            } else {
                console.log("No access token in file, refreshing...");
                return await this.refreshAccessToken();
            }
        } catch (err) {
            console.error("Error reading or parsing token file:", err);
            return await this.refreshAccessToken(); // Attempt to refresh if there's an error reading the file
        }
    }

    async refreshAccessToken(): Promise<string | null> {
        try {
            const clientId = process.env.TWITCH_CLIENT_ID;
            const clientSecret = process.env.TWITCH_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
                throw new Error(
                    "Twitch client ID and secret must be defined in environment variables."
                );
            }

            const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;

            const response = await fetch(tokenUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                console.log(
                    "Token fetch failed, trying again",
                    await response.json()
                );
                const retryResponse = await fetch(tokenUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (!retryResponse.ok) {
                    throw new Error(
                        `Failed to fetch token on retry: ${retryResponse.status} ${retryResponse.statusText}`
                    );
                }

                const retryJson: TwitchToken =
                    (await retryResponse.json()) as TwitchToken;

                if (retryJson.access_token) {
                    fs.writeFileSync(
                        this.tokenFilePath,
                        JSON.stringify(retryJson)
                    );
                    console.log("Token refreshed successfully.");
                    return retryJson.access_token;
                } else {
                    throw new Error(
                        `Failed to fetch token with retry: ${retryJson}`
                    );
                }
            }

            const json: TwitchToken = (await response.json()) as TwitchToken;

            fs.writeFileSync(this.tokenFilePath, JSON.stringify(json));
            console.log("Token Saved");
            return json.access_token || null;
        } catch (err) {
            console.error("An error occurred during token refresh:", err);
            return null;
        }
    }
}

interface TwitchUser {
    id: string;
    login: string;
    display_name: string;
    type: string;
    broadcaster_type: string;
    description: string;
    profile_image_url: string;
    offline_image_url: string;
    view_count: number;
    created_at: string;
}
const tokenManager = new TwitchTokenManager();
const getTwitchUserId = async (loginName: string): Promise<string | null> => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const accessToken = await tokenManager.getAccessToken();
    if (!clientId || !accessToken) {
        console.error(
            "Twitch client ID and access token must be defined in environment variables."
        );
        return null;
    }

    const apiUrl = `https://api.twitch.tv/helix/users?login=${loginName}`;

    try {
        const response = await fetch(apiUrl, {
            headers: {
                "Client-Id": clientId,
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
                return await getTwitchUserId(loginName);
            }
            return null;
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
            const user: TwitchUser = data.data[0] as TwitchUser; // Type assertion
            return user.id;
        } else {
            console.warn(`User with login name "${loginName}" not found.`);
            return null;
        }
    } catch (error) {
        console.error("Error during fetch:", error);
        return null;
    }
};
const getTwitchUser = async (loginName: string): Promise<TwitchUser | null> => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const accessToken = await tokenManager.getAccessToken();
    if (!clientId || !accessToken) {
        console.error(
            "Twitch client ID and access token must be defined in environment variables."
        );
        return null;
    }

    const apiUrl = `https://api.twitch.tv/helix/users?login=${loginName}`;

    try {
        const response = await fetch(apiUrl, {
            headers: {
                "Client-Id": clientId,
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
                return await getTwitchUser(loginName);
            }
            return null;
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
            const user: TwitchUser = data.data[0] as TwitchUser; // Type assertion
            return user;
        } else {
            console.warn(`User with login name "${loginName}" not found.`);
            return null;
        }
    } catch (error) {
        console.error("Error during fetch:", error);
        return null;
    }
};
const getSecret = (): string => {
    // This should come from a secure source (env variable, config file, etc.)
    const secret = process.env.TWITCH_EVENTSUB_SECRET;
    if (!secret) {
        throw new Error(
            "Twitch EventSub secret is not defined in environment variables."
        );
    }
    return secret;
};

const createEventSubSubscription = async (
    username: string,
    type: "stream.online"
) => {
    if (process.env.TWITCH_EVENTSUB == "true") {
        try {
            const userId = await getTwitchUserId(username);
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

            const secret = getSecret();
            const subscription = {
                type: type,
                version: "1",
                condition: {
                    broadcaster_user_id: userId!,
                },
                transport: {
                    method: "webhook",
                    callback: process.env.ROOT_SERVER + "/twitch/callback",
                    secret: secret,
                },
            };

            const response = await fetch(
                "https://api.twitch.tv/helix/eventsub/subscriptions",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Client-Id": process.env.TWITCH_CLIENT_ID!,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(subscription),
                }
            );

            if (!response.ok) {
                if (response.status != 409) {
                    console.error(
                        `Error creating EventSub subscription for ${type}: ${response.status} ${response.statusText}`
                    );
                    const errorBody = await response.text();
                    console.error("Response body:", errorBody);
                    return null;
                }
                return true;
            }
        } catch (error) {
            console.error("Error during fetch:", error);
            return null;
        }
    } else {
        return true;
    }
};
const deleteEventSubSubscription = async (username: string) => {
    if (process.env.TWITCH_EVENTSUB == "true") {
        try {
            const userId = await getTwitchUserId(username);
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
            const response = await fetch(
                `https://api.twitch.tv/helix/eventsub/subscriptions?user_id=${userId}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Client-Id": process.env.TWITCH_CLIENT_ID!,
                        "Content-Type": "application/json",
                    },
                }
            );
            const items = await response.json();
            if (items.data.length > 0) {
                const item = items.data[0];
                await fetch(
                    `https://api.twitch.tv/helix/eventsub/subscriptions?id=${item.id}`,
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Client-Id": process.env.TWITCH_CLIENT_ID!,
                            "Content-Type": "application/json",
                        },
                    }
                );
                return true;
            }
        } catch (error) {
            console.error("Error during fetch:", error);
            return null;
        }
    }
    return true;
};
export {
    TwitchTokenManager,
    getTwitchUserId,
    getTwitchUser,
    getSecret,
    createEventSubSubscription,
    deleteEventSubSubscription,
};

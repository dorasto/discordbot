interface XPost {
    id: string;
    link: string;
}

interface XProfile {
    avatar: string | null;
    bio: string | null;
    displayName: string | null;
    username: string | null;
    location: string | null;
    website: string | null;
    followers: number | null;
}
const decodePbsImage = (src: string): string => {
    if (src.startsWith("/pic/")) {
        return (
            "https://" +
            decodeURIComponent(src.replace("/pic/", ""))
        );
    }
    return src;
};
class XNitterManager {
    private baseUrl = "https://nitter.net";

    // ---------- POSTS ----------

    private extractLatestPost(html: string): XPost | null {
        const items =
            html.match(
                /<div class="timeline-item[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi
            ) || [];

        for (const itemHtml of items) {
            // ❌ Skip pinned + retweets
            if (
                itemHtml.includes('<div class="pinned">') ||
                itemHtml.includes('<div class="retweet-header">')
            ) {
                continue;
            }

            const linkMatch = itemHtml.match(
                /<a class="tweet-link" href="([^"]+)"/
            );

            if (!linkMatch) continue;

            const path = linkMatch[1];

            // ✅ Must be a real post
            if (!path.includes("/status/")) {
                continue;
            }

            // ❌ Skip posts that promote broadcasts
            if (
                itemHtml.includes("/broadcasts/") ||
                itemHtml.includes("/i/broadcasts/")
            ) {
                continue;
            }

            const cleanPath = path.replace(/#m$/, "");

            return {
                id: cleanPath.split("/").pop()!,
                link: `https://fixupx.com${cleanPath}`,
            };
        }

        return null;
    }

    // ---------- PROFILE ----------

    private extractProfile(html: string): XProfile {
        // Avatar
        const avatarMatch = html.match(
            /<a class="profile-card-avatar"[\s\S]*?<img[^>]*src="([^"]+)"/i
        );

        // Bio
        const bioMatch = html.match(
            /<div class="profile-bio">[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i
        );

        // Display name
        const nameMatch = html.match(
            /<a class="profile-card-fullname"[^>]*>([\s\S]*?)<\/a>/i
        );

        // Username
        const usernameMatch = html.match(
            /<a class="profile-card-username"[^>]*>@([^<]+)<\/a>/i
        );

        // Location
        const locationMatch = html.match(
            /<div class="profile-location">[\s\S]*?<span>([^<]+)<\/span>/i
        );

        // Website
        const websiteMatch = html.match(
            /<div class="profile-website">[\s\S]*?<a[^>]*href="([^"]+)"/i
        );

        // Followers
        const followersMatch = html.match(
            /<li class="followers">[\s\S]*?<span class="profile-stat-num">([^<]+)<\/span>/i
        );

        const avatar = avatarMatch
            ? decodePbsImage(avatarMatch[1])
            : null;

        const bio = bioMatch
            ? bioMatch[1].replace(/<[^>]+>/g, "").trim()
            : null;

        const displayName = nameMatch
            ? nameMatch[1].replace(/<[^>]+>/g, "").trim()
            : null;

        const username = usernameMatch
            ? `@${usernameMatch[1]}`
            : null;

        const location = locationMatch
            ? locationMatch[1].trim()
            : null;

        const website = websiteMatch
            ? websiteMatch[1].trim()
            : null;

        const followers = followersMatch
            ? Number(
                followersMatch[1]
                    .replace(/,/g, "")
                    .trim()
            )
            : null;

        return {
            avatar,
            bio,
            displayName,
            username,
            location,
            website,
            followers,
        };
    }

    // ---------- PUBLIC API ----------

    async getLatestPost(username: string): Promise<XPost | null> {
        const html = await this.fetchProfileHtml(username);
        if (!html) return null;
        return this.extractLatestPost(html);
    }

    async getProfile(username: string): Promise<XProfile | null> {
        const html = await this.fetchProfileHtml(username);
        if (!html) return null;
        return this.extractProfile(html);
    }

    private async fetchProfileHtml(
        username: string
    ): Promise<string | null> {
        try {
            const res = await fetch(`${this.baseUrl}/${username}`, {
                headers: {
                    accept:
                        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "accept-language": "en-US,en;q=0.5",
                    "cache-control": "no-cache",
                    "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                },
            });

            if (!res.ok) {
                console.error(
                    `Nitter fetch failed for ${username}:`,
                    res.status
                );
                return null;
            }

            return await res.text();
        } catch (err) {
            console.error("XNitterManager fetch error:", err);
            return null;
        }
    }
}

export { XNitterManager };
export type { XPost, XProfile };
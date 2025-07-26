import {
    ChatInputCommandInteraction,
    PermissionsBitField,
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} from "discord.js";
import {
    discord,
    AddButtonDataTwitch,
    AddButtonDataYoutubeLive,
    AddButtonDataYoutubeLatest,
    AddButtonDataYoutubeLatestShort,
    AddButtonDataKick,
} from "..";
import platforms from "../platforms";
export default {
    data: new SlashCommandBuilder()
        .setName("add")
        .setDescription("Add notification via platform")
        .addStringOption((option) =>
            option
                .setName("platform")
                .setDescription("Choose the platform")
                .addChoices(platforms)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("username")
                .setDescription("Username of the platform")
                .setRequired(true)
        )
        .addChannelOption((option) =>
            option
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setName("channel")
                .setDescription("Channel to add to")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription("Message to send")
                .setRequired(false)
        )
        .addBooleanOption((option) =>
            option
                .setName("keep_vod")
                .setDescription("Show the vod from that live")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(inter: ChatInputCommandInteraction) {
        try {
            await inter.deferReply({
                ephemeral: true,
            });
            const platform = inter.options.getString("platform");
            const username = inter.options.getString("username");
            const channel = inter.options.getChannel("channel");
            const keep_vod = inter.options.getBoolean("keep_vod");
            const message = inter.options.getString("message");
            try {
                if (platform === "twitch") {
                    const dataLiveReq = await fetch(
                        process.env.API_SERVER_LIVE + "/twitch/" + username,
                        {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }
                    );
                    const dataLive = await dataLiveReq.json();
                    if (!dataLive?.user?.username) {
                        return await inter.editReply({
                            content: `User ${username} not found on Twitch`,
                        });
                    }
                    const embed = new EmbedBuilder();
                    embed.setTitle(`${dataLive.user.username}`);
                    embed.setURL(`https://www.twitch.tv/${username}`);
                    embed.setAuthor({
                        name: "Doras Bot",
                        iconURL: discord.user?.avatarURL() || "",
                    });
                    embed.setColor(0x6441a5);
                    embed.setDescription(
                        `${username} added by ${inter.user.username}`
                    );
                    embed.setImage(dataLive.user.profile_image);
                    embed.setTimestamp();
                    let buttonAccept = new ButtonBuilder();
                    buttonAccept.setCustomId("accept-twitch");
                    buttonAccept.setLabel("Accept");
                    buttonAccept.setStyle(ButtonStyle.Success);
                    let buttonReject = new ButtonBuilder();
                    buttonReject.setCustomId("reject-twitch");
                    buttonReject.setLabel("Reject");
                    buttonReject.setStyle(ButtonStyle.Danger);
                    const row = new ActionRowBuilder().addComponents(
                        buttonAccept,
                        buttonReject
                    );
                    const data = await inter.editReply({
                        embeds: [embed],
                        //@ts-expect-error
                        components: [row],
                    });
                    AddButtonDataTwitch.set(data.id, {
                        username: username,
                        channel: channel?.id || "",
                        server: inter.guild?.id || "",
                        account: inter.user.id,
                        keep_vod: keep_vod || false,
                        mention: null,
                        message: message || null,
                    });
                    return;
                }
                if (platform === "kick") {
                    const dataLiveReq = await fetch(
                        process.env.API_SERVER_LIVE + "/kick/" + username,
                        {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }
                    );
                    const dataLive = await dataLiveReq.json();
                    if (!dataLive?.user?.username) {
                        return await inter.editReply({
                            content: `User ${username} not found on Kick`,
                        });
                    }
                    const embed = new EmbedBuilder();
                    embed.setTitle(`${dataLive.user.username}`);
                    embed.setURL(`https://kick.com/${username}`);
                    embed.setAuthor({
                        name: "Doras Bot",
                        iconURL: discord.user?.avatarURL() || "",
                    });
                    embed.setColor(0x53fc18);
                    embed.setDescription(
                        `${username} added by ${inter.user.username}`
                    );
                    embed.setImage(dataLive.user.profile_image);
                    embed.setTimestamp();
                    let buttonAccept = new ButtonBuilder();
                    buttonAccept.setCustomId("accept-kick");
                    buttonAccept.setLabel("Accept");
                    buttonAccept.setStyle(ButtonStyle.Success);
                    let buttonReject = new ButtonBuilder();
                    buttonReject.setCustomId("reject-kick");
                    buttonReject.setLabel("Reject");
                    buttonReject.setStyle(ButtonStyle.Danger);
                    const row = new ActionRowBuilder().addComponents(
                        buttonAccept,
                        buttonReject
                    );
                    const data = await inter.editReply({
                        embeds: [embed],
                        //@ts-expect-error
                        components: [row],
                    });
                    AddButtonDataKick.set(data.id, {
                        username: username,
                        channel: channel?.id || "",
                        server: inter.guild?.id || "",
                        account: inter.user.id,
                        keep_vod: keep_vod || false,
                        mention: null,
                        message: message || null,
                    });
                    return;
                }
                if (platform === "youtube-live") {
                    const dataLiveReq = await fetch(
                        process.env.API_SERVER_LIVE +
                            "/youtube/@" +
                            username?.replace("@", ""),
                        {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }
                    );
                    const dataLive = await dataLiveReq.json();
                    if (!dataLive?.channel?.id) {
                        return await inter.editReply({
                            content: `User ${username?.replace(
                                "@",
                                ""
                            )} not found on Youtube`,
                        });
                    }
                    const embed = new EmbedBuilder();
                    embed.setTitle(`${dataLive.channel.name}`);
                    embed.setURL(
                        `https://www.youtube.com/@${username?.replace("@", "")}`
                    );
                    embed.setAuthor({
                        name: "Doras Bot",
                        iconURL: discord.user?.avatarURL() || "",
                    });
                    embed.setColor(0x6441a5);
                    embed.setDescription(
                        `${username?.replace("@", "")} added by ${
                            inter.user.username
                        }`
                    );
                    embed.setImage(dataLive.channel.profile_image);
                    embed.setTimestamp();
                    let buttonAccept = new ButtonBuilder();
                    buttonAccept.setCustomId("accept-youtube-live");
                    buttonAccept.setLabel("Accept");
                    buttonAccept.setStyle(ButtonStyle.Success);
                    let buttonReject = new ButtonBuilder();
                    buttonReject.setCustomId("reject-youtube-live");
                    buttonReject.setLabel("Reject");
                    buttonReject.setStyle(ButtonStyle.Danger);
                    const row = new ActionRowBuilder().addComponents(
                        buttonAccept,
                        buttonReject
                    );
                    const data = await inter.editReply({
                        embeds: [embed],
                        //@ts-expect-error
                        components: [row],
                    });
                    AddButtonDataYoutubeLive.set(data.id, {
                        username: username?.replace("@", ""),
                        channel: channel?.id || "",
                        server: inter.guild?.id || "",
                        account: inter.user.id,
                        keep_vod: keep_vod || false,
                        mention: null,
                        message: message || null,
                    });
                    return;
                }
                if (platform === "youtube-latest") {
                    const dataLiveReq = await fetch(
                        process.env.API_SERVER_LIVE +
                            "/youtube/@" +
                            username?.replace("@", ""),
                        {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }
                    );
                    const dataLive = await dataLiveReq.json();
                    if (!dataLive?.channel?.id) {
                        return await inter.editReply({
                            content: `User ${username?.replace(
                                "@",
                                ""
                            )} not found on Youtube`,
                        });
                    }
                    const embed = new EmbedBuilder();
                    embed.setTitle(`${dataLive.channel.name}`);
                    embed.setURL(
                        `https://www.youtube.com/@${username?.replace("@", "")}`
                    );
                    embed.setAuthor({
                        name: "Doras Bot",
                        iconURL: discord.user?.avatarURL() || "",
                    });
                    embed.setColor(0x6441a5);
                    embed.setDescription(
                        `${username?.replace("@", "")} added by ${
                            inter.user.username
                        }`
                    );
                    embed.setImage(dataLive.channel.profile_image);
                    embed.setTimestamp();
                    let buttonAccept = new ButtonBuilder();
                    buttonAccept.setCustomId("accept-youtube-latest");
                    buttonAccept.setLabel("Accept");
                    buttonAccept.setStyle(ButtonStyle.Success);
                    let buttonReject = new ButtonBuilder();
                    buttonReject.setCustomId("reject-youtube-latest");
                    buttonReject.setLabel("Reject");
                    buttonReject.setStyle(ButtonStyle.Danger);
                    const row = new ActionRowBuilder().addComponents(
                        buttonAccept,
                        buttonReject
                    );
                    const data = await inter.editReply({
                        embeds: [embed],
                        //@ts-expect-error
                        components: [row],
                    });
                    AddButtonDataYoutubeLatest.set(data.id, {
                        username: username?.replace("@", ""),
                        channel: channel?.id || "",
                        server: inter.guild?.id || "",
                        account: inter.user.id,
                        message: message || null,
                        youtube_id: dataLive.channel?.id || "",
                    });
                    return;
                }
                if (platform === "youtube-short-latest") {
                    const dataLiveReq = await fetch(
                        process.env.API_SERVER_LIVE +
                            "/youtube/@" +
                            username?.replace("@", ""),
                        {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }
                    );
                    const dataLive = await dataLiveReq.json();
                    if (!dataLive?.channel?.id) {
                        return await inter.editReply({
                            content: `User ${username?.replace(
                                "@",
                                ""
                            )} not found on Youtube`,
                        });
                    }
                    const embed = new EmbedBuilder();
                    embed.setTitle(`${dataLive.channel.name}`);
                    embed.setURL(
                        `https://www.youtube.com/@${username?.replace("@", "")}`
                    );
                    embed.setAuthor({
                        name: "Doras Bot",
                        iconURL: discord.user?.avatarURL() || "",
                    });
                    embed.setColor(0x6441a5);
                    embed.setDescription(
                        `${username?.replace("@", "")} added by ${
                            inter.user.username
                        }`
                    );
                    embed.setImage(dataLive.channel.profile_image);
                    embed.setTimestamp();
                    let buttonAccept = new ButtonBuilder();
                    buttonAccept.setCustomId("accept-youtube-latest-short");
                    buttonAccept.setLabel("Accept");
                    buttonAccept.setStyle(ButtonStyle.Success);
                    let buttonReject = new ButtonBuilder();
                    buttonReject.setCustomId("reject-youtube-latest-short");
                    buttonReject.setLabel("Reject");
                    buttonReject.setStyle(ButtonStyle.Danger);
                    const row = new ActionRowBuilder().addComponents(
                        buttonAccept,
                        buttonReject
                    );
                    const data = await inter.editReply({
                        embeds: [embed],
                        //@ts-expect-error
                        components: [row],
                    });
                    AddButtonDataYoutubeLatestShort.set(data.id, {
                        username: username?.replace("@", ""),
                        channel: channel?.id || "",
                        server: inter.guild?.id || "",
                        account: inter.user.id,
                        message: message || null,
                        youtube_id: dataLive.channel?.id || "",
                    });
                    return;
                }
            } catch (error) {
                console.error("Error executing add command: ", error);
                await inter.editReply({
                    content: "There was an error executing the command.",
                });
            }
        } catch (error) {
            console.error("Error executing add command: ", error);
            await inter.editReply({
                content: "There was an error executing the command.",
            });
        }
    },
};

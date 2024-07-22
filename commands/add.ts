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
import { discord, AddButtonDataTwitch } from "..";
export default {
    data: new SlashCommandBuilder()
        .setName("add")
        .setDescription("Add twitch user")
        .addStringOption((option) =>
            option
                .setName("username")
                .setDescription("Twitch username to add")
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
        .addRoleOption((option) =>
            option.setName("mention").setDescription("Role to notify")
        )
        .addBooleanOption((option) =>
            option
                .setName("keep_vod")
                .setDescription("Show the vod from that live")
                .setRequired(false)
        ),
    permissions: [PermissionsBitField.Flags.Administrator],
    async execute(inter: ChatInputCommandInteraction) {
        try {
            await inter.deferReply({
                ephemeral: true,
            });
            const username = inter.options.getString("username");
            const channel = inter.options.getChannel("channel");
            const keep_vod = inter.options.getBoolean("keep_vod");
            const mention = inter.options.getRole("mention");
            try {
                const dataLiveReq = await fetch(
                    process.env.API_SERVER + "/v2/live/twitch/" + username,
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
                buttonAccept.setCustomId("accept");
                buttonAccept.setLabel("Accept");
                buttonAccept.setStyle(ButtonStyle.Success);
                let buttonReject = new ButtonBuilder();
                buttonReject.setCustomId("reject");
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
                    message: data.id,
                    keep_vod: keep_vod || false,
                    mention: mention?.id || null,
                });
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

/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

//import "./style.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType, makeRange } from "@utils/types";
import { ChannelStore, GuildMemberStore, GuildStore } from "@webpack/common";

const settings = definePluginSettings({
    SetLuminanceThreshold: {
        description: "Set threshold of luminance to be brightened.",
        type: OptionType.SLIDER,
        markers: makeRange(5, 40, 5),
        default: 15
    },
    SetLuminanceAmount: {
        description: "Set the luminance the role colors should be set to.",
        type: OptionType.SLIDER,
        markers: makeRange(50, 90, 5),
        default: 50
    },
    MemberListColors: {
        description: "Replace role colors in the member list.",
        restartNeeded: true,
        type: OptionType.BOOLEAN,
        default: true
    },
});

function getNameColor(color: string) {
    if (!/^#[0-9A-F]{6}$/i.test(color)) return false;

    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const lum = luminance(r, g, b);
    return lum < settings.store.SetLuminanceThreshold / 100;
}

function luminance(r: number, g: number, b: number): number {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function lighten(color) {
    if (color) {
        const { hue, saturation, lightness } = hexToHSL(color);
        const newHex = HSLToHex(hue, saturation, (getNameColor(color) ? settings.store.SetLuminanceAmount : lightness));
        return newHex
    }
    return "#FFFFFF";
}
function HSLToHex(h, s, l) {
    s /= 100;
    l /= 100;

    var c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c / 2,
        r,
        g,
        b;

    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
    }
    // Having obtained RGB, convert channels to hex
    r = Math.round((r + m) * 255).toString(16);
    g = Math.round((g + m) * 255).toString(16);
    b = Math.round((b + m) * 255).toString(16);

    // Prepend 0s, if necessary
    if (r.length == 1)
        r = "0" + r;
    if (g.length == 1)
        g = "0" + g;
    if (b.length == 1)
        b = "0" + b;

    return "#" + r + g + b;
}


function hexToHSL(hexCode: string) {
    // Hex => RGB normalized to 0-1
    const r = parseInt(hexCode.substring(1, 3), 16) / 255;
    const g = parseInt(hexCode.substring(3, 5), 16) / 255;
    const b = parseInt(hexCode.substring(5, 7), 16) / 255;

    // RGB => HSL
    const cMax = Math.max(r, g, b);
    const cMin = Math.min(r, g, b);
    const delta = cMax - cMin;

    let hue: number, saturation: number, lightness: number;

    lightness = (cMax + cMin) / 2;

    if (delta === 0) {
        // If r=g=b then the only thing that matters is lightness
        hue = 0;
        saturation = 0;
    } else {
        // Magic
        saturation = delta / (1 - Math.abs(2 * lightness - 1));

        if (cMax === r)
            hue = ((g - b) / delta) % 6;
        else if (cMax === g)
            hue = (b - r) / delta + 2;
        else
            hue = (r - g) / delta + 4;
        hue *= 60;
        if (hue < 0)
            hue += 360;
    }

    // Move saturation and lightness from 0-1 to 0-100
    saturation *= 100;
    lightness *= 100;

    return { hue, saturation, lightness };
}

export default definePlugin({
    name: "BrightenDarkRoles",
    description: "Sets hardly visible roles on usernames to white for readability.",
    authors: [{ name: "Yoshoness", id: 206081832289042432n }],
    settings,

    patches: [
        {
            find: '="SYSTEM_TAG"',
            replacement: {
                match: /(?<=colorString:\i,colorStrings:\i,colorRoleName:\i,displayNameStyles:\i}=)(\i)/,
                replace: "$self.setMessageListColor($1, arguments[0])"
            }
        },

        {
            find: "#{intl::GUILD_OWNER}),children:",
            replacement: {
                match: /(?<=colorString:\i,colorStrings:\i,colorRoleName:\i,.*}=)(\i),/,
                replace: "$self.setMessageListColor($1, arguments[0]),"
            },
            predicate: () => settings.store.MemberListColors
        },

        // Chat Mentions
        {
            find: ".USER_MENTION)",
            replacement: [
                {
                    match: /Vencord\.Plugins\.plugins\[\"RoleColorEverywhere\"\]\.getColorInt\((\i)\?.id,([^,]+?)\)/,
                    replace: "$self.setUserMentionColor($1?.id,$2)",
                }
            ]
        },

        // Role Mentions
        {
            find: ".ROLE_MENTION)",
            replacement: {
                match: /(?<=color:\i\?)(\i.color)/,
                replace: "$self.setRoleMentionColor($1)"
            }
        },

        // "Replying To" label
        {
            find: ".replyLabel",
            replacement: {
                match: /(?<=color:)(\i)(.*)(?<=roleColors:)(\i)/,
                replace: "$self.setReplyColor($1)$2$self.setReplyColor($3)"
            }
        },

        // Boost Menu
        {
            find: ".boostMessageUser",
            replacement: {
                match: /(r.colorStrings)/,
                replace: "$self.setBoostRoleColor($1)"
            }
        },

        // Voice Users
        {
            find: ".usernameSpeaking]:",
            replacement: [
                {
                    match: /\.usernameSpeaking\]:.+?,(?=children)(?<=guildId:(\i),.+?user:(\i).+?)/,
                    replace: "$&style:$self.setVoiceColor($2.id,$1),"
                }
            ]
        },
    ],

    setBoostRoleColor(roleColors) {
        for (const key in roleColors) {
            roleColors[key] = roleColors[key] ? lighten(roleColors[key]) : undefined;
        }
        return roleColors;
    },

    setMessageListColor(colorProps: { colorString: string, colorStrings?: Record<"primaryColor" | "secondaryColor" | "tertiaryColor", string>; }) {
        try {
            const colorString = lighten(colorProps.colorString);
            for (const key in colorProps.colorStrings) {
                colorProps.colorStrings[key] = colorProps.colorStrings[key] ? lighten(colorProps.colorStrings[key]) : undefined;
            }

            return {
                ...colorProps,
                colorString,
                colorStrings: colorProps.colorStrings && colorProps.colorStrings
            };
        } catch (e) {
            console.error("Failed to calculate message color strings:", e);
            return colorProps;
        }
    },

    setVoiceColor(userId: string, channelOrGuildId: string) {
        const colorString = this.getColorString(userId, channelOrGuildId);
        const newColorString = colorString ? lighten(colorString) : colorString;

        return newColorString && { color: newColorString };
    },

    setUserMentionColor(userId: string, channelOrGuildId: string) {
        const colorString = this.getColorString(userId, channelOrGuildId);
        const newColorString = colorString ? lighten(colorString) : colorString;

        return newColorString && parseInt(newColorString!.slice(1), 16);
    },

    setReplyColor(colorString) {
        try {
            if (typeof colorString == "object") {
                colorString.primaryColor = lighten(colorString.primaryColor);
                colorString.secondaryColor = lighten(colorString.secondaryColor);
                return colorString;
            }
            else if (typeof colorString == "string") {
                return lighten(colorString);
            }
        } catch {
            return colorString;
        }
    },

    setRoleMentionColor(colorInt, context) {
        const colorString = "#" + colorInt.toString(16).padStart(6, '0');

        // Color preview in role settings
        if (context?.message?.channel_id === "1337")
            return colorInt;

        if (context?.channel?.isPrivate()) {
            return colorInt;
        }
        const newColorString = colorString ? lighten(colorString) : colorString;

        return Number("0x" + newColorString.substring(1));
    },

    getColorString(userId: string, channelOrGuildId: string) {
        try {
            const guildId = ChannelStore.getChannel(channelOrGuildId)?.guild_id ?? GuildStore.getGuild(channelOrGuildId)?.id;
            if (guildId == null) return null;

            return GuildMemberStore.getMember(guildId, userId)?.colorString ?? null;
        } catch (e) {
            //new Logger("RoleColorEverywhere").error("Failed to get color string", e);
        }

        return null;
    },

    start() {

    },

    stop() {

    },
});

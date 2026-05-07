import coloredFactory from "../colored-actor-handle/main.js";

/**
 * One row in the directory chat list (avatar, title, last-message preview, drag to pinboard).
 */
export default async () => {
  const ColoredActorHandle = await coloredFactory();
  return {
    name: "ChatListItem",
    components: { ColoredActorHandle },
    props: {
      chat: { type: Object, required: true },
      chatId: { type: String, required: true },
      selectedChannel: { type: String, default: "" },
      lastMessage: { type: Object, default: null },
      isPinnedToBoard: { type: Boolean, default: false },
    },
    inject: ["chatAvatarInitial", "truncatePreview"],
    emits: ["drag-start", "pin-chat"],
    computed: {
      isActive() {
        return this.chatId === this.selectedChannel;
      },
      chatRoute() {
        return `/chat/${this.chatId}`;
      },
      previewSnippet() {
        if (!this.lastMessage) return "";
        const c = this.lastMessage.value.content;
        if (c) return this.truncatePreview(c);
        if (this.lastMessage.value.mediaKind === "image") return "[Image]";
        if (this.lastMessage.value.mediaKind === "video") return "[Video]";
        return "[Attachment]";
      },
    },
    methods: {
      avatarLetter() {
        return this.chatAvatarInitial(this.chat);
      },
    },
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
      r.text(),
    ),
  };
};

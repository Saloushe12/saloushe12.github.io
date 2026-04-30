import coloredFactory from "../colored-actor-handle/main.js";

/**
 * One chat message: tap to show Add-to-board / Delete; uses ColoredActorHandle for the sender.
 */
export default async () => {
  const ColoredActorHandle = await coloredFactory();
  return {
    name: "ChatMessageRow",
    components: { ColoredActorHandle },
    props: {
      message: { type: Object, required: true },
      channel: { type: String, required: true },
      isActionsOpen: { type: Boolean, default: false },
      isOnBoard: { type: Boolean, default: false },
      isAddingToBoard: { type: Boolean, default: false },
      isDeletingMsg: { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false },
    },
    emits: ["toggle", "add-to-board", "delete"],
    computed: {
      hasMedia() {
        return Boolean(this.message.value.mediaUrl);
      },
      isImage() {
        return this.message.value.mediaKind === "image";
      },
      isVideo() {
        return this.message.value.mediaKind === "video";
      },
      addLabel() {
        if (this.isOnBoard) return "On board";
        if (this.isAddingToBoard) return "Adding…";
        return "Add to board";
      },
      deleteLabel() {
        return this.isDeletingMsg ? "Deleting..." : "Delete";
      },
    },
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
      r.text(),
    ),
  };
};

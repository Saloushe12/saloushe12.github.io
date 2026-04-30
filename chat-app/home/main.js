import { chatRoomSetup } from "../chat-setup.js";

export default async () => {
  const { default: coloredFactory } = await import(
    "../components/colored-actor-handle/main.js"
  );
  const { default: sepFactory } = await import(
    "../components/message-time-separator/main.js"
  );
  const { default: listFactory } = await import(
    "../components/chat-list-item/main.js"
  );
  const { default: rowFactory } = await import(
    "../components/chat-message-row/main.js"
  );

  const [ColoredActorHandle, MessageTimeSeparator, ChatListItem, ChatMessageRow] =
    await Promise.all([
      coloredFactory(),
      sepFactory(),
      listFactory(),
      rowFactory(),
    ]);

  return {
    props: ["chatId"],
    setup() {
      return chatRoomSetup();
    },
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
      r.text(),
    ),
    components: {
      ColoredActorHandle,
      MessageTimeSeparator,
      ChatListItem,
      ChatMessageRow,
    },
  };
};

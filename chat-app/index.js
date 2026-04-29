import { createApp, ref, computed } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import {
  GraffitiPlugin,
  useGraffiti,
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

const DIRECTORY_CHANNEL = "designftw-26";

function setup() {
  const graffiti = useGraffiti();
  const session = useGraffitiSession();
  const channel = ref("");
  const selectedChat = ref(null);
  const myMessage = ref("");
  const newChatTitle = ref("");
  const isCreatingChat = ref(false);
  const isJoiningChat = ref(false);
  const joinError = ref("");
  const isPinning = ref(new Set());
  const isUnpinning = ref(new Set());

  // What: discover created chat objects
  // Where: class directory channel
  // Who: public (no allowed list)
  const chatSchema = {
    properties: {
      value: {
        required: ["activity", "type", "title", "channel", "published"],
        properties: {
          activity: { const: "Create" },
          type: { const: "Chat" },
          title: { type: "string" },
          channel: { type: "string" },
          published: { type: "number" },
        },
      },
    },
  };

  const { objects: chats, isFirstPoll: areChatsLoading } = useGraffitiDiscover(
    () => [DIRECTORY_CHANNEL],
    chatSchema,
    undefined,
    true,
  );

  // What: discover message objects
  // Where: currently selected chat channel
  // Who: public (no allowed list)
  const messageSchema = {
    properties: {
      value: {
        required: ["content", "published"],
        properties: {
          content: { type: "string" },
          published: { type: "number" },
        },
      },
    },
  };

  const { objects: messageObjects, isFirstPoll: areMessageObjectsLoading } =
    useGraffitiDiscover(
      () => (channel.value ? [channel.value] : []),
      messageSchema,
      undefined,
      true,
    );

  // What: discover join objects
  // Where: currently selected chat channel
  // Who: public (no allowed list)
  const joinSchema = {
    properties: {
      value: {
        required: ["activity", "target", "published"],
        properties: {
          activity: { const: "Join" },
          target: { type: "string" },
          published: { type: "number" },
        },
      },
    },
  };

  const { objects: joins } = useGraffitiDiscover(
    () => (channel.value ? [channel.value] : []),
    joinSchema,
    undefined,
    true,
  );

  const pinSchema = {
    properties: {
      value: {
        required: ["activity", "target", "content", "published"],
        properties: {
          activity: { const: "Pin" },
          target: { type: "string" },
          content: { type: "string" },
          published: { type: "number" },
        },
      },
    },
  };

  const { objects: pinObjects, isFirstPoll: arePinsLoading } = useGraffitiDiscover(
    () => (channel.value ? [channel.value] : []),
    pinSchema,
    undefined,
    true,
  );

  const sortedChats = computed(() => {
    return chats.value.toSorted((a, b) => b.value.published - a.value.published);
  });

  const sortedMessageObjects = computed(() => {
    return messageObjects.value.toSorted(
      (a, b) => b.value.published - a.value.published,
    );
  });

  const joinCount = computed(() => {
    const actors = new Set(joins.value.map((join) => join.actor));
    return actors.size;
  });

  const currentChatTitle = computed(() => {
    return selectedChat.value?.value.title || "No chat selected";
  });

  const latestPinsByTarget = computed(() => {
    return pinObjects.value.reduce((acc, pin) => {
      const key = pin.value.target;
      if (!acc[key] || acc[key].value.published < pin.value.published) {
        acc[key] = pin;
      }
      return acc;
    }, {});
  });

  const pinnedMessages = computed(() => {
    return Object.values(latestPinsByTarget.value).toSorted(
      (a, b) => b.value.published - a.value.published,
    );
  });

  const pinnedTargets = computed(() => {
    return new Set(pinnedMessages.value.map((pin) => pin.value.target));
  });

  function selectChat(chat) {
    selectedChat.value = chat;
    channel.value = chat.value.channel;
    joinError.value = "";
  }

  // What: Create chat object
  // Where: DIRECTORY_CHANNEL
  // Who: public (no allowed list)
  async function newChat() {
    if (!session.value) return;
    isCreatingChat.value = true;
    try {
      const chatChannel = crypto.randomUUID();
      const title = newChatTitle.value.trim() || "My Chat";
      await graffiti.post(
        {
          value: {
            activity: "Create",
            type: "Chat",
            title,
            channel: chatChannel,
            published: Date.now(),
          },
          channels: [DIRECTORY_CHANNEL],
        },
        session.value,
      );
      const createdChat = {
        value: { title, channel: chatChannel, published: Date.now() },
      };
      selectChat(createdChat);
      newChatTitle.value = "";
    } finally {
      isCreatingChat.value = false;
    }
  }

  // What: Join chat object
  // Where: selected chat channel
  // Who: public (no allowed list)
  async function joinCurrentChat() {
    if (!session.value || !channel.value) {
      joinError.value = "Select a chat before joining.";
      return;
    }
    isJoiningChat.value = true;
    joinError.value = "";
    try {
      await graffiti.post(
        {
          value: {
            activity: "Join",
            target: channel.value,
            published: Date.now(),
          },
          channels: [channel.value],
        },
        session.value,
      );
    } finally {
      isJoiningChat.value = false;
    }
  }

  const isSending = ref(false);
  async function sendMessage() {
    if (!session.value || !channel.value) return;
    isSending.value = true;
    try {
      await graffiti.post(
        {
          value: {
            content: myMessage.value,
            published: Date.now(),
          },
          channels: [channel.value],
        },
        session.value,
      );
      myMessage.value = "";
    } finally {
      isSending.value = false;
    }
  }

  const isDeleting = ref(new Set());
  async function deleteMessage(message) {
    const nextDeleting = new Set(isDeleting.value);
    nextDeleting.add(message.url);
    isDeleting.value = nextDeleting;
    try {
      await graffiti.delete(message, session.value);
    } finally {
      const afterDelete = new Set(isDeleting.value);
      afterDelete.delete(message.url);
      isDeleting.value = afterDelete;
    }
  }

  async function pinMessage(message) {
    if (!session.value || !channel.value || pinnedTargets.value.has(message.url)) return;
    const nextPinning = new Set(isPinning.value);
    nextPinning.add(message.url);
    isPinning.value = nextPinning;
    try {
      await graffiti.post(
        {
          value: {
            activity: "Pin",
            target: message.url,
            content: message.value.content,
            published: Date.now(),
          },
          channels: [channel.value],
        },
        session.value,
      );
    } finally {
      const afterPin = new Set(isPinning.value);
      afterPin.delete(message.url);
      isPinning.value = afterPin;
    }
  }

  async function unpinMessage(pin) {
    if (!session.value) return;
    const nextUnpinning = new Set(isUnpinning.value);
    nextUnpinning.add(pin.url);
    isUnpinning.value = nextUnpinning;
    try {
      await graffiti.delete(pin, session.value);
    } finally {
      const afterUnpin = new Set(isUnpinning.value);
      afterUnpin.delete(pin.url);
      isUnpinning.value = afterUnpin;
    }
  }

  return {
    DIRECTORY_CHANNEL,
    selectedChat,
    currentChatTitle,
    channel,
    chats,
    areChatsLoading,
    sortedChats,
    joins,
    joinCount,
    joinError,
    myMessage,
    areMessageObjectsLoading,
    sortedMessageObjects,
    arePinsLoading,
    pinnedMessages,
    pinnedTargets,
    isCreatingChat,
    isJoiningChat,
    isSending,
    isPinning,
    isUnpinning,
    sendMessage,
    isDeleting,
    deleteMessage,
    pinMessage,
    unpinMessage,
    newChat,
    joinCurrentChat,
    newChatTitle,
    selectChat,
  };
}

const App = { template: "#template", setup };

createApp(App)
  .use(GraffitiPlugin, {
    // graffiti: new GraffitiLocal(),
    graffiti: new GraffitiDecentralized(),
  })
  .mount("#app");

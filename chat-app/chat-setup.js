import { ref, computed, provide, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  useGraffiti,
  useGraffitiSession,
  useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";
import {
  loadActorColorMap,
  saveActorColorMap,
  randomReadableHandleColor,
} from "./actor-colors.js";
import {
  SEPARATOR_GAP_MS,
  buildMessageTimeline,
} from "./message-timeline.js";

const DIRECTORY_CHANNEL = "pinboard-all";

const CHAT_DRAG_MIME = "application/x-chat-board";
const BOARD_ITEM_DRAG_MIME = "application/x-pinboard-item";
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const VIDEO_COMPRESS_THRESHOLD_BYTES = 12 * 1024 * 1024;
const VIDEO_MAX_WIDTH = 960;
const VIDEO_MAX_HEIGHT = 540;
const VIDEO_TARGET_BITRATE = 1_100_000;

const boardSchema = {
  properties: {
    value: {
      required: ["activity", "kind", "published"],
      properties: {
        activity: { const: "Board" },
        kind: { enum: ["message", "chat", "media"] },
        published: { type: "number" },
        messageUrl: { type: "string" },
        contentSnapshot: { type: "string" },
        messageActor: { type: "string" },
        chatChannel: { type: "string" },
        chatTitle: { type: "string" },
        chatIcon: { type: "string" },
        mediaUrl: { type: "string" },
        mediaMime: { type: "string" },
      },
    },
  },
};

/** Main chat room UI state & Graffiti hooks (used by the home route). */
export function chatRoomSetup() {
  const graffiti = useGraffiti();
  const session = useGraffitiSession();
  const route = useRoute();
  const router = useRouter();
  const channel = ref("");
  const selectedChat = ref(null);
  const myMessage = ref("");
  const selectedMediaFile = ref(null);
  const isUploadingMedia = ref(false);
  const mediaError = ref("");
  const draggingBoardItemUrl = ref("");
  const activeBoardChatChannel = ref("");
  const boardChatDraftByChannel = ref({});
  const boardChatErrorByChannel = ref({});
  const isSendingBoardChat = ref(new Set());
  const boardMediaPreview = ref(null);
  const chatNameInput = ref("");
  const isCreatingChat = ref(false);
  const isJoiningChat = ref(false);
  const joinError = ref("");
  const isAddingMessageToBoard = ref(new Set());
  const isRemovingBoardItem = ref(new Set());
  /** Message row whose Add / Delete actions are visible (toggle by clicking the message). */
  const openMessageActionsUrl = ref(null);

  /** Per chat channel, per actor — persisted in localStorage (see actor-colors.js). */
  const actorColorsByChat = ref(loadActorColorMap());

  function colorForActorInChat(chatId, actorId) {
    if (!chatId || !actorId) return null;
    const m = actorColorsByChat.value;
    const existing = m[chatId]?.[actorId];
    if (existing) return existing;
    const col = randomReadableHandleColor();
    const next = {
      ...m,
      [chatId]: { ...(m[chatId] || {}), [actorId]: col },
    };
    actorColorsByChat.value = next;
    saveActorColorMap(next);
    return col;
  }

  /** Single call from templates: `{ color }` or `{}`. */
  function actorColorStyle(chatId, actorId) {
    const c = colorForActorInChat(chatId, actorId);
    return c ? { color: c } : {};
  }

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
          icon: { type: "string" },
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

  const allChatChannels = computed(() =>
    chats.value.map((c) => c.value.channel).filter(Boolean),
  );

  const messageSchema = {
    properties: {
      value: {
        required: ["content", "published"],
        properties: {
          content: { type: "string" },
          published: { type: "number" },
          mediaUrl: { type: "string" },
          mediaMime: { type: "string" },
          mediaKind: { enum: ["image", "video"] },
          mediaName: { type: "string" },
        },
      },
    },
  };

  const { objects: allChatMessages, isFirstPoll: areMessageObjectsLoading } =
    useGraffitiDiscover(
      () => allChatChannels.value,
      messageSchema,
      undefined,
      true,
    );

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
  const { objects: joinsAcrossChats } = useGraffitiDiscover(
    () => allChatChannels.value,
    joinSchema,
    undefined,
    true,
  );

  /** Personal pinboard: stored on your actor channel so it works without a chat selected and survives route changes. */
  const { objects: boardObjects, isFirstPoll: areBoardLoading } = useGraffitiDiscover(
    () => (session.value?.actor ? [session.value.actor] : []),
    boardSchema,
    () => session.value ?? undefined,
    true,
  );

  const sortedChats = computed(() => {
    return chats.value.toSorted((a, b) => b.value.published - a.value.published);
  });

  const lastMessageByChannel = computed(() => {
    const map = Object.create(null);
    for (const msg of allChatMessages.value) {
      const published = msg.value.published;
      const chans = msg.channels;
      if (!chans?.length) continue;
      for (const ch of chans) {
        const prev = map[ch];
        if (!prev || published > prev.value.published) {
          map[ch] = msg;
        }
      }
    }
    return map;
  });

  /** Oldest first — for timeline + readable conversation order. */
  const messagesChronological = computed(() => {
    const ch = channel.value;
    if (!ch) return [];
    return allChatMessages.value
      .filter((m) => Array.isArray(m.channels) && m.channels.includes(ch))
      .toSorted((a, b) => a.value.published - b.value.published);
  });

  const messageTimeline = computed(() =>
    buildMessageTimeline(messagesChronological.value, SEPARATOR_GAP_MS),
  );

  const sortedBoardItems = computed(() => {
    return boardObjects.value.toSorted(
      (a, b) => b.value.published - a.value.published,
    );
  });

  /** Messages already represented on the board (disables duplicate “Add” from the button). */
  const boardMessageUrls = computed(() => {
    const set = new Set();
    for (const o of boardObjects.value) {
      if (o.value.kind === "message" && o.value.messageUrl) {
        set.add(o.value.messageUrl);
      }
    }
    return set;
  });

  const boardChatChannels = computed(() => {
    const set = new Set();
    for (const o of boardObjects.value) {
      if (o.value.kind === "chat" && o.value.chatChannel) {
        set.add(o.value.chatChannel);
      }
    }
    return set;
  });

  const boardMediaUrls = computed(() => {
    const set = new Set();
    for (const o of boardObjects.value) {
      if (o.value.kind === "media" && o.value.mediaUrl) {
        set.add(o.value.mediaUrl);
      }
    }
    return set;
  });

  function lastMessageFor(chat) {
    const key = chat.value.channel;
    if (!key) return null;
    return lastMessageByChannel.value[key] ?? null;
  }

  function chatAvatarInitial(chat) {
    const t = chat.value.title?.trim() || "?";
    return t.charAt(0).toUpperCase();
  }

  function truncatePreview(text, max = 72) {
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  const messagesByChannelNewest = computed(() => {
    const map = Object.create(null);
    for (const msg of allChatMessages.value) {
      if (!Array.isArray(msg.channels) || !msg.channels.length) continue;
      for (const ch of msg.channels) {
        if (!map[ch]) map[ch] = [];
        map[ch].push(msg);
      }
    }
    for (const ch of Object.keys(map)) {
      map[ch].sort((a, b) => b.value.published - a.value.published);
    }
    return map;
  });

  const selectedMediaName = computed(() => selectedMediaFile.value?.name || "");
  const hasPendingMedia = computed(() => Boolean(selectedMediaFile.value));

  const joinCount = computed(() => {
    const actors = new Set(joins.value.map((join) => join.actor));
    return actors.size;
  });

  /** True when a Join object from the current actor exists on the selected channel. */
  const hasJoinedCurrentChat = computed(() => {
    const act = session.value?.actor;
    if (!act || !channel.value) return false;
    return joins.value.some((j) => j.actor === act);
  });
  const joinedChannelsByMe = computed(() => {
    const set = new Set();
    const actor = session.value?.actor;
    if (!actor) return set;
    for (const j of joinsAcrossChats.value) {
      if (j.actor !== actor) continue;
      const ch = j.value?.target;
      if (ch) set.add(ch);
    }
    return set;
  });

  const currentChatTitle = computed(() => {
    return selectedChat.value?.value.title || "No chat selected";
  });

  async function postJoinActivity(targetChannel) {
    if (!session.value) return;
    await graffiti.post(
      {
        value: {
          activity: "Join",
          target: targetChannel,
          published: Date.now(),
        },
        channels: [targetChannel],
      },
      session.value,
    );
  }

  function selectChat(chat, updateRoute = true) {
    selectedChat.value = chat;
    channel.value = chat.value.channel;
    joinError.value = "";
    openMessageActionsUrl.value = null;
    if (updateRoute) {
      const nextId = chat.value.channel;
      if (nextId && route.params.chatId !== nextId) {
        router.push(`/chat/${nextId}`);
      }
    }
  }

  function clearSelectedChat(updateRoute = true) {
    selectedChat.value = null;
    channel.value = "";
    openMessageActionsUrl.value = null;
    if (updateRoute && route.path !== "/") {
      router.push("/");
    }
  }

  function syncSelectedChatFromRoute() {
    const routeChatId =
      typeof route.params.chatId === "string" ? route.params.chatId : "";
    if (!routeChatId) {
      clearSelectedChat(false);
      return;
    }
    const match =
      sortedChats.value.find((c) => c.value.channel === routeChatId) ?? null;
    if (match) {
      selectChat(match, false);
      return;
    }
    clearSelectedChat(false);
  }

  function toggleMessageActions(url) {
    openMessageActionsUrl.value =
      openMessageActionsUrl.value === url ? null : url;
  }

  function findChatByTrimmedName(name) {
    const needle = name.trim().toLowerCase();
    if (!needle) return null;
    return (
      sortedChats.value.find((c) => c.value.title.trim().toLowerCase() === needle) ??
      null
    );
  }

  async function createChatByName() {
    if (!session.value) return;
    const title = chatNameInput.value.trim();
    if (!title) {
      joinError.value = "Enter a chat name to create.";
      return;
    }
    joinError.value = "";
    isCreatingChat.value = true;
    try {
      const chatChannel = crypto.randomUUID();
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
      await postJoinActivity(chatChannel);
      chatNameInput.value = "";
    } finally {
      isCreatingChat.value = false;
    }
  }

  async function joinChatByName() {
    if (!session.value) return;
    const name = chatNameInput.value.trim();
    if (!name) {
      joinError.value = "Enter a chat name to join.";
      return;
    }
    const hit = findChatByTrimmedName(name);
    if (!hit) {
      joinError.value = "No chat found with that name.";
      return;
    }
    joinError.value = "";
    isJoiningChat.value = true;
    try {
      selectChat(hit);
      await postJoinActivity(hit.value.channel);
      chatNameInput.value = "";
    } finally {
      isJoiningChat.value = false;
    }
  }

  async function joinCurrentChat() {
    if (!session.value || !channel.value) {
      joinError.value = "Select a chat before joining.";
      return;
    }
    if (hasJoinedCurrentChat.value) return;
    isJoiningChat.value = true;
    joinError.value = "";
    try {
      await postJoinActivity(channel.value);
    } finally {
      isJoiningChat.value = false;
    }
  }

  async function leaveCurrentChat() {
    if (!session.value?.actor || !channel.value) return;
    const mine = joins.value.filter((j) => j.actor === session.value.actor);
    if (!mine.length) return;
    isJoiningChat.value = true;
    joinError.value = "";
    try {
      for (const obj of mine) {
        await graffiti.delete(obj, session.value);
      }
    } catch {
      joinError.value = "Could not leave this chat. Try again.";
    } finally {
      isJoiningChat.value = false;
    }
  }

  function boardRecentMessages(chatChannel, limit = 3) {
    if (!chatChannel) return [];
    const list = messagesByChannelNewest.value[chatChannel] || [];
    return list.slice(0, limit);
  }

  function isBoardChatOpen(chatChannel) {
    return activeBoardChatChannel.value === chatChannel;
  }

  function openBoardChat(chatChannel) {
    if (!chatChannel) return;
    activeBoardChatChannel.value =
      activeBoardChatChannel.value === chatChannel ? "" : chatChannel;
  }

  function boardChatDraft(chatChannel) {
    return boardChatDraftByChannel.value[chatChannel] || "";
  }

  function setBoardChatDraft(chatChannel, value) {
    boardChatDraftByChannel.value = {
      ...boardChatDraftByChannel.value,
      [chatChannel]: value,
    };
  }

  function boardChatError(chatChannel) {
    return boardChatErrorByChannel.value[chatChannel] || "";
  }

  function setBoardChatError(chatChannel, value) {
    boardChatErrorByChannel.value = {
      ...boardChatErrorByChannel.value,
      [chatChannel]: value,
    };
  }

  function canSendBoardChat(chatChannel) {
    return joinedChannelsByMe.value.has(chatChannel);
  }

  function isSendingBoardChatChannel(chatChannel) {
    return isSendingBoardChat.value.has(chatChannel);
  }

  async function sendBoardChatMessage(chatChannel) {
    if (!session.value || !chatChannel) return;
    const draft = boardChatDraft(chatChannel).trim();
    if (!draft) return;
    if (!canSendBoardChat(chatChannel)) {
      setBoardChatError(chatChannel, "Join this chat before sending.");
      return;
    }
    const next = new Set(isSendingBoardChat.value);
    next.add(chatChannel);
    isSendingBoardChat.value = next;
    setBoardChatError(chatChannel, "");
    try {
      await graffiti.post(
        {
          value: {
            content: draft,
            published: Date.now(),
          },
          channels: [chatChannel],
        },
        session.value,
      );
      setBoardChatDraft(chatChannel, "");
    } catch {
      setBoardChatError(chatChannel, "Could not send message.");
    } finally {
      const after = new Set(isSendingBoardChat.value);
      after.delete(chatChannel);
      isSendingBoardChat.value = after;
    }
  }

  function onPickComposeMedia(event) {
    mediaError.value = "";
    const file = event?.target?.files?.[0] ?? null;
    if (!file) {
      selectedMediaFile.value = null;
      return;
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      mediaError.value = "Only image and video files are supported.";
      selectedMediaFile.value = null;
      event.target.value = "";
      return;
    }
    if (file.size > MAX_MEDIA_BYTES) {
      mediaError.value = "File is too large. Please use a file under 25MB.";
      selectedMediaFile.value = null;
      event.target.value = "";
      return;
    }
    selectedMediaFile.value = file;
  }

  function clearComposeMedia() {
    selectedMediaFile.value = null;
    mediaError.value = "";
  }

  async function compressVideoFileIfNeeded(file) {
    if (!file.type.startsWith("video/")) return file;
    if (file.size <= VIDEO_COMPRESS_THRESHOLD_BYTES) return file;
    if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
      return file;
    }

    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "auto";
      video.playsInline = true;
      video.src = URL.createObjectURL(file);

      const fail = () => {
        URL.revokeObjectURL(video.src);
        resolve(file);
      };

      video.onerror = fail;
      video.onloadedmetadata = () => {
        const srcW = video.videoWidth || VIDEO_MAX_WIDTH;
        const srcH = video.videoHeight || VIDEO_MAX_HEIGHT;
        const scale = Math.min(
          1,
          VIDEO_MAX_WIDTH / srcW,
          VIDEO_MAX_HEIGHT / srcH,
        );
        const outW = Math.max(2, Math.round(srcW * scale));
        const outH = Math.max(2, Math.round(srcH * scale));

        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          fail();
          return;
        }

        const stream = canvas.captureStream(24);
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: VIDEO_TARGET_BITRATE,
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data?.size) chunks.push(e.data);
        };
        recorder.onerror = fail;
        recorder.onstop = () => {
          URL.revokeObjectURL(video.src);
          const blob = new Blob(chunks, { type: "video/webm" });
          if (!blob.size || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], `${file.name}.webm`, {
            type: "video/webm",
          });
          resolve(compressed);
        };

        video.currentTime = 0;
        video.playbackRate = 1;
        video.play().then(() => {
          recorder.start(500);
          const draw = () => {
            if (video.ended || video.paused) return;
            ctx.drawImage(video, 0, 0, outW, outH);
            requestAnimationFrame(draw);
          };
          draw();
        }).catch(fail);

        video.onended = () => {
          if (recorder.state !== "inactive") recorder.stop();
        };
      };
    });
  }

  const isSending = ref(false);
  async function sendMessage() {
    if (!session.value || !channel.value || !hasJoinedCurrentChat.value) return;
    if (!myMessage.value.trim() && !selectedMediaFile.value) return;
    isSending.value = true;
    isUploadingMedia.value = false;
    mediaError.value = "";
    try {
      let mediaUrl = "";
      let mediaMime = "";
      let mediaKind = "";
      let mediaName = "";

      if (selectedMediaFile.value) {
        isUploadingMedia.value = true;
        const uploadFile = await compressVideoFileIfNeeded(selectedMediaFile.value);
        mediaUrl = await graffiti.postMedia({ data: uploadFile }, session.value);
        mediaMime = uploadFile.type;
        mediaKind = uploadFile.type.startsWith("video/") ? "video" : "image";
        mediaName = selectedMediaFile.value.name;
        isUploadingMedia.value = false;
      }

      await graffiti.post(
        {
          value: {
            content: myMessage.value.trim(),
            published: Date.now(),
            ...(mediaUrl ? { mediaUrl, mediaMime, mediaKind, mediaName } : {}),
          },
          channels: [channel.value],
        },
        session.value,
      );
      myMessage.value = "";
      clearComposeMedia();
    } catch {
      mediaError.value = "Failed to send media. Try a smaller file.";
    } finally {
      isUploadingMedia.value = false;
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

  async function postBoardObject(value) {
    if (!session.value?.actor) return;
    await graffiti.post(
      {
        value,
        channels: [session.value.actor],
      },
      session.value,
    );
  }

  async function addMessageToBoard(message) {
    if (
      !session.value ||
      boardMessageUrls.value.has(message.url) ||
      isAddingMessageToBoard.value.has(message.url)
    ) {
      return;
    }
    const next = new Set(isAddingMessageToBoard.value);
    next.add(message.url);
    isAddingMessageToBoard.value = next;
    try {
      await postBoardObject({
        activity: "Board",
        kind: "message",
        published: Date.now(),
        messageUrl: message.url,
        contentSnapshot: message.value.content,
        messageActor: message.actor,
      });
    } finally {
      const after = new Set(isAddingMessageToBoard.value);
      after.delete(message.url);
      isAddingMessageToBoard.value = after;
    }
  }

  async function addChatRefToBoard(payload) {
    if (!payload.chatChannel || boardChatChannels.value.has(payload.chatChannel)) {
      return;
    }
    await postBoardObject({
      activity: "Board",
      kind: "chat",
      published: Date.now(),
      chatChannel: payload.chatChannel,
      chatTitle: payload.chatTitle,
      ...(payload.chatIcon ? { chatIcon: payload.chatIcon } : {}),
    });
  }

  async function addImageFileToBoard(file) {
    if (file.type.startsWith("video/")) return;
    if (!file.type.startsWith("image/")) return;
    const mediaUrl = await graffiti.postMedia({ data: file }, session.value);
    if (boardMediaUrls.value.has(mediaUrl)) {
      return;
    }
    await postBoardObject({
      activity: "Board",
      kind: "media",
      published: Date.now(),
      mediaUrl,
      mediaMime: file.type,
    });
  }

  function onChatDragStart(chat, event) {
    if (!chat?.value?.channel) return;
    const payload = JSON.stringify({
      chatChannel: chat.value.channel,
      chatTitle: chat.value.title || "Chat",
      chatIcon: chat.value.icon || "",
    });
    event.dataTransfer.setData(CHAT_DRAG_MIME, payload);
    event.dataTransfer.setData("text/plain", payload);
    event.dataTransfer.effectAllowed = "copy";
  }

  function onBoardItemDragStart(item, event) {
    if (!item?.url) return;
    const payload = JSON.stringify({ boardItemUrl: item.url });
    draggingBoardItemUrl.value = item.url;
    event.dataTransfer.setData(BOARD_ITEM_DRAG_MIME, payload);
    event.dataTransfer.effectAllowed = "copy";
  }

  function computeInsertedPublished(ordered, newIndex) {
    const prev = ordered[newIndex - 1] || null;
    const next = ordered[newIndex] || null;
    if (prev && next) {
      return (prev.value.published + next.value.published) / 2;
    }
    if (prev) return prev.value.published - 1;
    if (next) return next.value.published + 1;
    return Date.now();
  }

  async function reorderBoardItem(dragUrl, dropTargetUrl = "") {
    if (!dragUrl) return;
    const current = sortedBoardItems.value;
    const moved = current.find((o) => o.url === dragUrl);
    if (!moved) return;

    const withoutMoved = current.filter((o) => o.url !== dragUrl);
    let newIndex = withoutMoved.length;
    if (dropTargetUrl) {
      const targetIndex = withoutMoved.findIndex((o) => o.url === dropTargetUrl);
      if (targetIndex >= 0) {
        // Insert after the target tile so users can drag items "below" others.
        newIndex = targetIndex + 1;
      }
    }

    const newPublished = computeInsertedPublished(withoutMoved, newIndex);
    if (newPublished === moved.value.published) return;
    await postBoardObject({
      ...moved.value,
      published: newPublished,
    });
    await graffiti.delete(moved, session.value);
  }

  function onBoardDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  async function onBoardDrop(event, dropTargetItem = null) {
    event.preventDefault();
    if (!session.value?.actor) return;
    const boardDragRaw = event.dataTransfer.getData(BOARD_ITEM_DRAG_MIME);
    if (boardDragRaw) {
      try {
        const data = JSON.parse(boardDragRaw);
        const dragUrl = data.boardItemUrl || draggingBoardItemUrl.value;
        const targetUrl = dropTargetItem?.url || "";
        await reorderBoardItem(dragUrl, targetUrl);
      } catch {
        /* ignore malformed board item drag payloads */
      } finally {
        draggingBoardItemUrl.value = "";
      }
      return;
    }

    const files = event.dataTransfer?.files;
    if (files?.length) {
      for (const file of files) {
        await addImageFileToBoard(file);
      }
      return;
    }

    let raw =
      event.dataTransfer.getData(CHAT_DRAG_MIME) ||
      event.dataTransfer.getData("text/uri-list") ||
      event.dataTransfer.getData("text/plain");
    if (!raw) return;
    raw = raw.trim();
    try {
      const data = JSON.parse(raw);
      if (data.chatChannel && data.chatTitle !== undefined) {
        await addChatRefToBoard({
          chatChannel: data.chatChannel,
          chatTitle: data.chatTitle,
          chatIcon: data.chatIcon || undefined,
        });
      }
      return;
    } catch {
      // If a board media item is dragged back onto the board, browsers often provide
      // its URL through text/uri-list or text/plain. Skip duplicates.
      if (/^https?:\/\//i.test(raw) && boardMediaUrls.value.has(raw)) {
        return;
      }
    }
  }

  async function removeBoardItem(item) {
    if (!session.value) return;
    const next = new Set(isRemovingBoardItem.value);
    next.add(item.url);
    isRemovingBoardItem.value = next;
    try {
      await graffiti.delete(item, session.value);
    } finally {
      const after = new Set(isRemovingBoardItem.value);
      after.delete(item.url);
      isRemovingBoardItem.value = after;
    }
  }

  function canRemoveBoardItem(item) {
    return item.actor === session.value?.actor;
  }

  function openBoardMediaPreview(item) {
    const url = item?.value?.mediaUrl;
    if (!url) return;
    const mime = item.value.mediaMime || "";
    const kind = mime.startsWith("video/")
      ? "video"
      : mime.startsWith("image/")
        ? "image"
        : "image";
    boardMediaPreview.value = {
      url,
      kind,
      mime,
      name: item.value.mediaName || "",
    };
  }

  function closeBoardMediaPreview() {
    boardMediaPreview.value = null;
  }

  watch(
    () => [
      route.params.chatId,
      sortedChats.value.map((c) => c.value.channel).join("|"),
    ],
    () => {
      syncSelectedChatFromRoute();
    },
    { immediate: true },
  );

  provide("actorColorStyle", actorColorStyle);
  provide("chatAvatarInitial", chatAvatarInitial);
  provide("truncatePreview", truncatePreview);

  return {
    DIRECTORY_CHANNEL,
    selectedChat,
    currentChatTitle,
    channel,
    chats,
    areChatsLoading,
    sortedChats,
    lastMessageFor,
    chatAvatarInitial,
    truncatePreview,
    joins,
    joinCount,
    hasJoinedCurrentChat,
    joinError,
    mediaError,
    myMessage,
    selectedMediaName,
    hasPendingMedia,
    areMessageObjectsLoading,
    messagesChronological,
    messageTimeline,
    areBoardLoading,
    sortedBoardItems,
    boardMessageUrls,
    isCreatingChat,
    isJoiningChat,
    isSending,
    isAddingMessageToBoard,
    isRemovingBoardItem,
    sendMessage,
    onPickComposeMedia,
    clearComposeMedia,
    isDeleting,
    deleteMessage,
    addMessageToBoard,
    boardRecentMessages,
    isBoardChatOpen,
    openBoardChat,
    boardChatDraft,
    setBoardChatDraft,
    boardChatError,
    canSendBoardChat,
    isSendingBoardChatChannel,
    sendBoardChatMessage,
    removeBoardItem,
    canRemoveBoardItem,
    boardMediaPreview,
    openBoardMediaPreview,
    closeBoardMediaPreview,
    onChatDragStart,
    onBoardItemDragStart,
    onBoardDragOver,
    onBoardDrop,
    createChatByName,
    joinChatByName,
    joinCurrentChat,
    leaveCurrentChat,
    chatNameInput,
    selectChat,
    openMessageActionsUrl,
    toggleMessageActions,
    isUploadingMedia,
  };
}

export { DIRECTORY_CHANNEL };

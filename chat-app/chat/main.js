export default async () => ({
  props: ["chatId"],
  setup(props) {
    return { chatId: props.chatId };
  },
  template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
    r.text(),
  ),
});

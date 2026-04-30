/** Centered timestamp pill between message groups (used once per timeline break via v-for). */
export default async () => ({
  name: "MessageTimeSeparator",
  props: {
    label: { type: String, required: true },
  },
  template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
    r.text(),
  ),
});

export default async () => ({
  props: ["actor"],
  setup(props) {
    return { actor: props.actor };
  },
  template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
    r.text(),
  ),
});

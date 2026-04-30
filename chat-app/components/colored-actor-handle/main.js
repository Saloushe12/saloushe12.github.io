/**
 * Graffiti handle with per-(colorChannel, actor) color from localStorage (see chat-setup provide).
 * Used in chat list previews, message rows, and pinboard message tiles.
 */

let definitionPromise;

export default async () => {
  if (!definitionPromise) {
    definitionPromise = (async () => ({
      name: "ColoredActorHandle",
      props: {
        actor: { type: String, required: true },
        /** Chat channel id for palette scope, or "__pinboard__" for pinboard-only colors */
        colorChannel: { type: String, required: true },
      },
      inject: ["actorColorStyle"],
      computed: {
        colorStyle() {
          return this.actorColorStyle(this.colorChannel, this.actor);
        },
      },
      template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
        r.text(),
      ),
    }))();
  }
  return definitionPromise;
};

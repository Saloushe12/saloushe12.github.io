import { createApp, watch } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import {
  GraffitiPlugin,
  useGraffitiSession,
} from "@graffiti-garden/wrapper-vue";
import { useRoute, useRouter } from "vue-router";

function loadComponent(name) {
  return () => import(`./${name}/main.js`).then((m) => m.default());
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/login", component: loadComponent("login") },
    { path: "/", component: loadComponent("home") },
    { path: "/chat/:chatId", component: loadComponent("home"), props: true },
    { path: "/profile/:actor", component: loadComponent("profile"), props: true },
  ],
});

createApp({
  template: "#template",
  setup() {
    const session = useGraffitiSession();
    const route = useRoute();
    const appRouter = useRouter();
    watch(
      () => [Boolean(session.value), route.path],
      ([isLoggedIn, path]) => {
        if (!isLoggedIn && path !== "/login") {
          appRouter.replace("/login");
        }
        if (isLoggedIn && path === "/login") {
          appRouter.replace("/");
        }
      },
      { immediate: true },
    );
    return { session };
  },
})
  .use(router)
  .use(GraffitiPlugin, {
    graffiti: new GraffitiDecentralized(),
  })
  .mount("#app");

import { displayHandle } from "@kleavox/core";
import "./styles/global.css";

const account = document.querySelector<HTMLElement>("[data-account]");
const signIn = document.querySelector<HTMLElement>("[data-signin]");
const menu = document.querySelector<HTMLElement>("[data-account-menu]");
const trigger = document.querySelector<HTMLButtonElement>(
  "[data-account-trigger]",
);
const dropdown = document.querySelector<HTMLElement>("[data-account-dropdown]");
const name = document.querySelector<HTMLElement>("[data-account-name]");
const logout = document.querySelector<HTMLButtonElement>("[data-logout]");

const closeMenu = () => {
  dropdown?.setAttribute("hidden", "");
  trigger?.setAttribute("aria-expanded", "false");
};

trigger?.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = trigger.getAttribute("aria-expanded") === "true";
  if (open) {
    closeMenu();
  } else {
    dropdown?.removeAttribute("hidden");
    trigger.setAttribute("aria-expanded", "true");
  }
});

dropdown?.addEventListener("click", (event) => event.stopPropagation());
window.addEventListener("click", closeMenu);

logout?.addEventListener("click", async () => {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
  } finally {
    window.location.reload();
  }
});

fetch("/api/session", { credentials: "include" })
  .then((response) =>
    response.ok ? response.json() : { authenticated: false },
  )
  .then(
    (data: {
      authenticated: boolean;
      identity?: { username?: string; email?: string; role?: string };
    }) => {
      if (!data.authenticated || !data.identity) return;
      if (name) {
        name.textContent = displayHandle(
          data.identity.username,
          data.identity.email,
        );
      }
      signIn?.setAttribute("hidden", "");
      menu?.removeAttribute("hidden");
      account?.classList.add("is-authenticated");
      if (data.identity.role === "ADMIN") {
        document
          .querySelectorAll("[data-pulse-only]")
          .forEach((element) => element.removeAttribute("hidden"));
      }
    },
  )
  .catch(() => {});
